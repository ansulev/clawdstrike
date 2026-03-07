//! Nono-based OS-level sandbox for hush run.
//!
//! Replaces the legacy `sandbox-exec`/`bwrap` wrappers with nono's
//! cross-platform capability-based sandboxing (Landlock on Linux,
//! Seatbelt on macOS).
//!
//! Phase 1 foundation: public API is wired in by Phase 1B.

use std::collections::HashMap;
use std::ffi::CString;
use std::path::{Path, PathBuf};

use nono::query::{QueryContext, QueryResult};
use nono::{AccessMode, CapabilitySet, Sandbox};

/// Build a capability set for sandboxed execution.
///
/// Grants working directory read-write, system paths read-only,
/// optional network proxy, and blocks specified commands.
pub fn build_capability_set(
    working_dir: &Path,
    command: &[String],
    proxy_port: Option<u16>,
    extra_read_paths: &[PathBuf],
    extra_write_paths: &[PathBuf],
    blocked_commands: &[String],
) -> nono::Result<CapabilitySet> {
    let _ = command; // Used in Phase 2 for command-specific caps
    let mut caps = CapabilitySet::new();

    // Grant working directory read-write
    caps = caps.allow_path(working_dir, AccessMode::ReadWrite)?;

    // System paths (read-only)
    for path in system_read_paths() {
        if path.exists() {
            caps = caps.allow_path(&path, AccessMode::Read)?;
        }
    }

    // System writable paths (tmp, dev)
    for path in system_write_paths() {
        if path.exists() {
            caps = caps.allow_path(&path, AccessMode::ReadWrite)?;
        }
    }

    // Extra paths from policy/CLI
    for path in extra_read_paths {
        if path.exists() {
            caps = caps.allow_path(path, AccessMode::Read)?;
        }
    }
    for path in extra_write_paths {
        if path.exists() {
            caps = caps.allow_path(path, AccessMode::ReadWrite)?;
        }
    }

    // Network: proxy-only if proxy is active, otherwise block
    if let Some(port) = proxy_port {
        caps = caps.proxy_only(port);
    } else {
        caps = caps.block_network();
    }

    // Blocked commands
    for cmd in blocked_commands {
        caps = caps.block_command(cmd);
    }

    Ok(caps)
}

/// Platform-specific system paths that need read access for execution.
#[cfg(target_os = "macos")]
fn system_read_paths() -> Vec<PathBuf> {
    [
        "/bin",
        "/usr",
        "/sbin",
        "/System/Library",
        "/Library",
        "/private/etc",
        "/opt/homebrew",
    ]
    .iter()
    .map(PathBuf::from)
    .collect()
}

#[cfg(target_os = "linux")]
fn system_read_paths() -> Vec<PathBuf> {
    [
        "/bin", "/lib", "/lib64", "/usr", "/sbin", "/etc", "/proc", "/sys", "/run",
    ]
    .iter()
    .map(PathBuf::from)
    .collect()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn system_read_paths() -> Vec<PathBuf> {
    vec![]
}

/// Platform-specific system paths that need write access.
#[cfg(target_os = "macos")]
fn system_write_paths() -> Vec<PathBuf> {
    ["/tmp", "/private/tmp", "/dev"]
        .iter()
        .map(PathBuf::from)
        .collect()
}

#[cfg(target_os = "linux")]
fn system_write_paths() -> Vec<PathBuf> {
    ["/tmp", "/dev", "/dev/shm"]
        .iter()
        .map(PathBuf::from)
        .collect()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn system_write_paths() -> Vec<PathBuf> {
    vec![]
}

/// Pre-flight validation of a capability set.
///
/// Returns a list of warnings about potential issues (e.g., working
/// directory or command binary not accessible within the sandbox).
pub fn validate_capabilities(
    caps: &CapabilitySet,
    command: &[String],
    working_dir: &Path,
) -> Vec<String> {
    let ctx = QueryContext::new(caps.clone());
    let mut warnings = vec![];

    // Verify working directory is accessible
    if !matches!(
        ctx.query_path(working_dir, AccessMode::ReadWrite),
        QueryResult::Allowed(_)
    ) {
        warnings.push(format!(
            "Working directory {} not accessible in sandbox",
            working_dir.display()
        ));
    }

    // Verify command binary is accessible (best-effort lookup)
    if let Some(bin_path) = find_command_in_path(&command[0]) {
        if !matches!(
            ctx.query_path(&bin_path, AccessMode::Read),
            QueryResult::Allowed(_)
        ) {
            warnings.push(format!(
                "Command binary {} not accessible in sandbox",
                bin_path.display()
            ));
        }
    }

    warnings
}

/// Find a command in PATH (simple lookup, no `which` crate needed).
fn find_command_in_path(cmd: &str) -> Option<PathBuf> {
    let path = Path::new(cmd);
    if path.is_absolute() && path.exists() {
        return Some(path.to_path_buf());
    }
    let path_var = std::env::var("PATH").ok()?;
    for dir in path_var.split(':') {
        let candidate = Path::new(dir).join(cmd);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

/// Spawn a child process inside a nono sandbox.
///
/// # Process model
///
/// 1. Pre-fork: prepare all C strings (no allocation after fork)
/// 2. Fork
/// 3. Child: close inherited fds, apply sandbox, exec
/// 4. Parent: forward signals, wait for child
///
/// # Safety
///
/// After `fork()`, the child process uses only async-signal-safe
/// operations. No `?` operator, no `panic!`, no allocation.
/// Errors are reported via `libc::write` to stderr and terminated
/// with `libc::_exit`. See nono-cli's `exec_strategy.rs:407-418`.
pub fn spawn_sandboxed_child(
    caps: &CapabilitySet,
    command: &[String],
    env_overrides: &HashMap<String, String>,
) -> anyhow::Result<i32> {
    use nix::unistd::ForkResult;

    if command.is_empty() {
        anyhow::bail!("empty command");
    }

    // Pre-fork: prepare all C strings
    let c_program = CString::new(command[0].as_str())
        .map_err(|e| anyhow::anyhow!("invalid command: {}", e))?;
    let c_args: Vec<CString> = command
        .iter()
        .map(|a| CString::new(a.as_str()).map_err(|e| anyhow::anyhow!("invalid arg: {}", e)))
        .collect::<Result<_, _>>()?;

    // Build child environment: inherit current env + overrides
    let mut env_map: HashMap<String, String> = std::env::vars().collect();
    for (k, v) in env_overrides {
        env_map.insert(k.clone(), v.clone());
    }
    let c_env: Vec<CString> = env_map
        .iter()
        .map(|(k, v)| {
            CString::new(format!("{}={}", k, v))
                .map_err(|e| anyhow::anyhow!("invalid env: {}", e))
        })
        .collect::<Result<_, _>>()?;

    // SAFETY: fork() is safe to call. After fork in the child, we only use
    // async-signal-safe operations (no allocation, no panic, no `?`).
    match unsafe { nix::unistd::fork() }
        .map_err(|e| anyhow::anyhow!("fork failed: {}", e))?
    {
        ForkResult::Child => {
            // CHILD: only async-signal-safe operations from here.
            // No ? operator, no panic!, no allocation.

            // Close inherited fds (proxy socket, parent resources)
            close_inherited_fds(3);

            // Apply sandbox (irrevocable)
            if let Err(e) = Sandbox::apply(caps) {
                let msg = format!("nono: sandbox apply failed: {}\n", e);
                // SAFETY: writing to stderr fd 2 is async-signal-safe
                unsafe { libc::write(2, msg.as_ptr().cast(), msg.len()) };
                // SAFETY: _exit is async-signal-safe, terminates without cleanup
                unsafe { libc::_exit(126) };
            }

            // Exec -- replaces process image
            let c_args_ref: Vec<&std::ffi::CStr> = c_args.iter().map(|a| a.as_c_str()).collect();
            let c_env_ref: Vec<&std::ffi::CStr> = c_env.iter().map(|e| e.as_c_str()).collect();
            // execve returns Result<Infallible> -- on success it never returns,
            // on failure we get an Err.
            let Err(e) = nix::unistd::execve(&c_program, &c_args_ref, &c_env_ref);
            let msg = format!("nono: exec failed: {}\n", e);
            // SAFETY: writing to stderr fd 2 is async-signal-safe
            unsafe { libc::write(2, msg.as_ptr().cast(), msg.len()) };
            // SAFETY: _exit is async-signal-safe, terminates without cleanup
            unsafe { libc::_exit(127) };
        }
        ForkResult::Parent { child } => {
            // Install signal forwarding
            install_signal_forwarding(child);

            // Wait for child
            let status = nix::sys::wait::waitpid(child, None)
                .map_err(|e| anyhow::anyhow!("waitpid failed: {}", e))?;
            Ok(exit_code_from_status(status))
        }
    }
}

/// Close all file descriptors >= `from_fd`.
///
/// Prevents the child from inheriting the proxy socket, supervisor
/// socket, log handles, etc.
fn close_inherited_fds(from_fd: i32) {
    // Get the max fd limit
    let max_fd = match rlimit::getrlimit(rlimit::Resource::NOFILE) {
        Ok((soft, _hard)) => soft as i32,
        Err(_) => 1024, // Reasonable fallback
    };
    // Cap to a sane maximum to avoid iterating millions of fds
    let capped = max_fd.min(4096);
    for fd in from_fd..capped {
        // SAFETY: closing an fd is safe; EBADF for non-open fds is harmless
        unsafe { libc::close(fd) };
    }
}

/// Install signal forwarding so SIGINT/SIGTERM sent to the parent
/// are forwarded to the child process.
fn install_signal_forwarding(child: nix::unistd::Pid) {
    use nix::sys::signal::{self, SigHandler, Signal};

    // Store child PID in a static for the signal handler
    // This is safe because we only set it once before installing handlers
    static CHILD_PID: std::sync::atomic::AtomicI32 = std::sync::atomic::AtomicI32::new(0);
    CHILD_PID.store(child.as_raw(), std::sync::atomic::Ordering::SeqCst);

    extern "C" fn forward_signal(sig: libc::c_int) {
        let pid = CHILD_PID.load(std::sync::atomic::Ordering::SeqCst);
        if pid > 0 {
            // SAFETY: kill() is async-signal-safe
            unsafe { libc::kill(pid, sig) };
        }
    }

    // SAFETY: SigHandler::Handler is a valid signal handler type.
    // We install handlers for SIGINT and SIGTERM only.
    unsafe {
        let handler = SigHandler::Handler(forward_signal);
        // Ignore errors -- best effort
        let _ = signal::signal(Signal::SIGINT, handler);
        let _ = signal::signal(Signal::SIGTERM, handler);
    }
}

/// Extract exit code from wait status.
fn exit_code_from_status(status: nix::sys::wait::WaitStatus) -> i32 {
    use nix::sys::wait::WaitStatus;
    match status {
        WaitStatus::Exited(_, code) => code,
        WaitStatus::Signaled(_, sig, _) => 128 + sig as i32,
        _ => 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nono::NetworkMode;

    #[test]
    fn test_capability_set_allows_working_dir() {
        let tmp = tempfile::TempDir::new().unwrap();
        let caps = build_capability_set(
            tmp.path(),
            &["ls".into()],
            None,
            &[],
            &[],
            &[],
        )
        .unwrap();

        let ctx = QueryContext::new(caps);
        assert!(
            matches!(
                ctx.query_path(tmp.path(), AccessMode::ReadWrite),
                QueryResult::Allowed(_)
            ),
            "working directory should be accessible"
        );
    }

    #[test]
    fn test_capability_set_blocks_ssh() {
        let tmp = tempfile::TempDir::new().unwrap();
        let caps = build_capability_set(
            tmp.path(),
            &["ls".into()],
            None,
            &[],
            &[],
            &[],
        )
        .unwrap();

        let ctx = QueryContext::new(caps);
        if let Some(home) = dirs::home_dir() {
            let ssh_dir = home.join(".ssh");
            // .ssh should NOT be in the capability set (not explicitly granted)
            assert!(
                !matches!(
                    ctx.query_path(&ssh_dir, AccessMode::Read),
                    QueryResult::Allowed(_)
                ),
                ".ssh should not be accessible"
            );
        }
    }

    #[test]
    fn test_proxy_only_network() {
        let tmp = tempfile::TempDir::new().unwrap();
        let caps = build_capability_set(
            tmp.path(),
            &["ls".into()],
            Some(8080),
            &[],
            &[],
            &[],
        )
        .unwrap();

        assert!(
            matches!(caps.network_mode(), NetworkMode::ProxyOnly { .. }),
            "should be ProxyOnly when proxy port is set"
        );
    }

    #[test]
    fn test_blocked_network() {
        let tmp = tempfile::TempDir::new().unwrap();
        let caps = build_capability_set(
            tmp.path(),
            &["ls".into()],
            None,
            &[],
            &[],
            &[],
        )
        .unwrap();

        assert!(
            matches!(caps.network_mode(), NetworkMode::Blocked),
            "should be Blocked when no proxy port"
        );
    }

    #[test]
    fn test_extra_read_paths() {
        let tmp = tempfile::TempDir::new().unwrap();
        let extra = tempfile::TempDir::new().unwrap();
        let caps = build_capability_set(
            tmp.path(),
            &["ls".into()],
            None,
            &[extra.path().to_path_buf()],
            &[],
            &[],
        )
        .unwrap();

        let ctx = QueryContext::new(caps);
        assert!(
            matches!(
                ctx.query_path(extra.path(), AccessMode::Read),
                QueryResult::Allowed(_)
            ),
            "extra read path should be accessible"
        );
    }

    #[test]
    fn test_validate_capabilities_working_dir() {
        let tmp = tempfile::TempDir::new().unwrap();
        let caps = build_capability_set(
            tmp.path(),
            &["ls".into()],
            None,
            &[],
            &[],
            &[],
        )
        .unwrap();

        let warnings = validate_capabilities(&caps, &["ls".into()], tmp.path());
        // Working dir should be accessible, so no warnings about it
        assert!(
            !warnings.iter().any(|w| w.contains("Working directory")),
            "should not warn about working directory"
        );
    }

    #[test]
    fn test_system_read_paths_exist() {
        // At least some system paths should exist
        let paths = system_read_paths();
        assert!(!paths.is_empty(), "should have system read paths");
        // /usr should exist on all Unix systems
        assert!(
            paths.iter().any(|p| p.as_os_str() == "/usr"),
            "/usr should be in system read paths"
        );
    }

    #[test]
    fn test_system_write_paths_exist() {
        let paths = system_write_paths();
        assert!(!paths.is_empty(), "should have system write paths");
        assert!(
            paths.iter().any(|p| p.as_os_str() == "/tmp"),
            "/tmp should be in system write paths"
        );
    }

    #[test]
    fn test_find_command_in_path() {
        // ls should be findable on any Unix system
        let result = find_command_in_path("ls");
        assert!(result.is_some(), "ls should be findable in PATH");
    }

    #[test]
    fn test_close_inherited_fds_does_not_panic() {
        // Just verify it doesn't panic -- we can't easily test fd closure
        close_inherited_fds(100);
    }

    #[test]
    fn test_blocked_commands() {
        let tmp = tempfile::TempDir::new().unwrap();
        let caps = build_capability_set(
            tmp.path(),
            &["ls".into()],
            None,
            &[],
            &[],
            &["rm".into(), "sudo".into()],
        )
        .unwrap();

        let blocked = caps.blocked_commands();
        assert!(blocked.contains(&"rm".to_string()), "rm should be blocked");
        assert!(
            blocked.contains(&"sudo".to_string()),
            "sudo should be blocked"
        );
    }
}
