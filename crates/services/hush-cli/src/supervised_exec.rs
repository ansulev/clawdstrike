//! Supervised execution with nono sandbox + ClawdStrike guard enforcement.
//!
//! Uses nono's supervisor IPC to route file operations through guards
//! for real-time allow/deny decisions at the kernel level.
//!
//! # Process model
//!
//! 1. Pre-fork: create supervisor socket pair, prepare C strings
//! 2. Fork
//! 3. Child: close inherited fds (except child socket), apply static sandbox, exec
//! 4. Parent: run supervisor loop on dedicated OS thread, forward signals, wait
//!
//! # Platform differences
//!
//! - **Linux**: seccomp-notify intercepts openat/openat2; supervisor receives
//!   notify fd from child and runs the recv_notif loop
//! - **macOS**: extension-based flow; child sends CapabilityRequests over the
//!   supervisor socket, supervisor issues extension tokens

use std::collections::HashMap;
use std::ffi::CString;
use std::sync::Arc;

use clawdstrike::sandbox::supervisor::GuardSupervisorBackend;
use clawdstrike::sandbox::{SupervisorStats, TimestampedDenial};
use clawdstrike::{GuardContext, HushEngine};
use nono::{ApprovalBackend, ApprovalDecision, CapabilitySet, NeverGrantChecker, SupervisorSocket};

use crate::sandbox_nono;

/// Result of supervised execution.
pub struct SupervisedResult {
    pub exit_code: i32,
    pub stats: SupervisorStats,
    pub denials: Vec<TimestampedDenial>,
}

/// Spawn a supervised child process.
///
/// The supervisor intercepts file operations and routes them through
/// ClawdStrike guards for real-time enforcement.
///
/// # Safety
///
/// After `fork()`, the child process uses only async-signal-safe
/// operations. See `sandbox_nono.rs` for the same pattern.
pub fn spawn_supervised_child(
    caps: &CapabilitySet,
    command: &[String],
    env_overrides: &HashMap<String, String>,
    engine: Arc<HushEngine>,
    context: GuardContext,
    never_grant: NeverGrantChecker,
) -> anyhow::Result<SupervisedResult> {
    use nix::unistd::ForkResult;

    if command.is_empty() {
        anyhow::bail!("empty command");
    }

    // Create supervisor socket pair
    let (supervisor_sock, child_sock) = SupervisorSocket::pair()
        .map_err(|e| anyhow::anyhow!("failed to create supervisor socket: {e}"))?;

    // Pre-fork: prepare all C strings (no allocation after fork)
    let c_program =
        CString::new(command[0].as_str()).map_err(|e| anyhow::anyhow!("invalid command: {e}"))?;
    let c_args: Vec<CString> = command
        .iter()
        .map(|a| CString::new(a.as_str()).map_err(|e| anyhow::anyhow!("invalid arg: {e}")))
        .collect::<Result<_, _>>()?;

    let mut env_map: HashMap<String, String> = std::env::vars().collect();
    for (k, v) in env_overrides {
        env_map.insert(k.clone(), v.clone());
    }
    let c_env: Vec<CString> = env_map
        .iter()
        .map(|(k, v)| {
            CString::new(format!("{k}={v}")).map_err(|e| anyhow::anyhow!("invalid env: {e}"))
        })
        .collect::<Result<_, _>>()?;

    let child_sock_fd = child_sock.as_raw_fd();

    // SAFETY: fork() is safe. After fork in the child, we only use
    // async-signal-safe operations (no allocation, no panic, no `?`).
    match unsafe { nix::unistd::fork() }.map_err(|e| anyhow::anyhow!("fork failed: {e}"))? {
        ForkResult::Child => {
            // CHILD: async-signal-safe only from here.
            // No ? operator, no panic!, no allocation.
            drop(supervisor_sock);

            // Close inherited fds except stdin/stdout/stderr + child socket
            close_inherited_fds_except(3, child_sock_fd);

            // Apply static sandbox (irrevocable)
            if let Err(e) = nono::Sandbox::apply(caps) {
                let msg = format!("nono: sandbox apply failed: {e}\n");
                // SAFETY: write to stderr is async-signal-safe
                unsafe { libc::write(2, msg.as_ptr().cast(), msg.len()) };
                // SAFETY: _exit is async-signal-safe
                unsafe { libc::_exit(126) };
            }

            // Exec -- replaces process image
            let c_args_ref: Vec<&std::ffi::CStr> = c_args.iter().map(|a| a.as_c_str()).collect();
            let c_env_ref: Vec<&std::ffi::CStr> = c_env.iter().map(|e| e.as_c_str()).collect();
            let Err(e) = nix::unistd::execve(&c_program, &c_args_ref, &c_env_ref);
            let msg = format!("nono: exec failed: {e}\n");
            // SAFETY: write to stderr is async-signal-safe
            unsafe { libc::write(2, msg.as_ptr().cast(), msg.len()) };
            // SAFETY: _exit is async-signal-safe
            unsafe { libc::_exit(127) };
        }
        ForkResult::Parent { child } => {
            drop(child_sock);

            let backend = GuardSupervisorBackend::new(engine, context);

            // Run supervisor loop on a dedicated OS thread (NOT async --
            // recv_message blocks and must not run on a tokio worker thread)
            let supervisor_handle = std::thread::spawn(move || {
                run_supervisor_loop(supervisor_sock, backend, never_grant)
            });

            // Install signal forwarding so SIGINT/SIGTERM reach the child
            sandbox_nono::install_signal_forwarding_pub(child);

            // Wait for child
            let status = nix::sys::wait::waitpid(child, None)
                .map_err(|e| anyhow::anyhow!("waitpid failed: {e}"))?;

            // Collect supervisor results
            let (stats, denials) = supervisor_handle
                .join()
                .map_err(|_| anyhow::anyhow!("supervisor thread panicked"))?;

            Ok(SupervisedResult {
                exit_code: exit_code_from_status(status),
                stats,
                denials,
            })
        }
    }
}

/// Supervisor loop -- runs on a dedicated OS thread.
///
/// Receives [`SupervisorMessage`]s from the child, checks the never-grant
/// list first, then routes through the [`GuardSupervisorBackend`].
fn run_supervisor_loop(
    mut socket: SupervisorSocket,
    backend: GuardSupervisorBackend,
    never_grant: NeverGrantChecker,
) -> (SupervisorStats, Vec<TimestampedDenial>) {
    let mut stats = SupervisorStats {
        enabled: true,
        backend: backend.backend_name().to_string(),
        ..Default::default()
    };
    let mut denials = Vec::new();

    while let Ok(msg) = socket.recv_message() {
        let nono::supervisor::SupervisorMessage::Request(request) = msg;
        stats.requests_total = stats.requests_total.saturating_add(1);

        // Never-grant check BEFORE guard evaluation
        if never_grant.is_blocked(&request.path) {
            stats.requests_denied = stats.requests_denied.saturating_add(1);
            stats.never_grant_blocks = stats.never_grant_blocks.saturating_add(1);
            denials.push(TimestampedDenial {
                path: request.path.to_string_lossy().to_string(),
                access: format!("{}", request.access),
                reason: "Path is in never_grant list".to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
            });
            let _ = socket.send_response(&nono::supervisor::SupervisorResponse::Decision {
                request_id: request.request_id.clone(),
                decision: ApprovalDecision::Denied {
                    reason: "Path is in never_grant list".into(),
                },
            });
            continue;
        }

        // Route through guards
        match backend.request_capability(&request) {
            Ok(ApprovalDecision::Granted) => {
                stats.requests_granted = stats.requests_granted.saturating_add(1);
                let _ = socket.send_response(&nono::supervisor::SupervisorResponse::Decision {
                    request_id: request.request_id.clone(),
                    decision: ApprovalDecision::Granted,
                });
            }
            Ok(ref decision @ ApprovalDecision::Denied { ref reason }) => {
                stats.requests_denied = stats.requests_denied.saturating_add(1);
                denials.push(TimestampedDenial {
                    path: request.path.to_string_lossy().to_string(),
                    access: format!("{}", request.access),
                    reason: reason.clone(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                });
                let _ = socket.send_response(&nono::supervisor::SupervisorResponse::Decision {
                    request_id: request.request_id.clone(),
                    decision: decision.clone(),
                });
            }
            Ok(decision) => {
                stats.requests_denied = stats.requests_denied.saturating_add(1);
                let _ = socket.send_response(&nono::supervisor::SupervisorResponse::Decision {
                    request_id: request.request_id.clone(),
                    decision,
                });
            }
            Err(_) => {
                stats.requests_denied = stats.requests_denied.saturating_add(1);
                let _ = socket.send_response(&nono::supervisor::SupervisorResponse::Decision {
                    request_id: request.request_id.clone(),
                    decision: ApprovalDecision::Denied {
                        reason: "Guard evaluation error".into(),
                    },
                });
            }
        }
    }

    (stats, denials)
}

/// Close all file descriptors from `from_fd` to the soft NOFILE limit,
/// except `keep_fd`.
fn close_inherited_fds_except(from_fd: i32, keep_fd: i32) {
    // On Linux, enumerate /proc/self/fd for precise fd closing
    #[cfg(target_os = "linux")]
    {
        if let Ok(entries) = std::fs::read_dir("/proc/self/fd") {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if let Ok(fd) = name.parse::<i32>() {
                        if fd >= from_fd && fd != keep_fd {
                            // SAFETY: closing an fd is safe; EBADF is harmless
                            unsafe { libc::close(fd) };
                        }
                    }
                }
            }
            return;
        }
    }

    // Fallback: iterate from from_fd to soft NOFILE limit
    let max_fd = match rlimit::getrlimit(rlimit::Resource::NOFILE) {
        Ok((soft, _)) => soft as i32,
        Err(_) => 1024,
    };
    let capped = max_fd.min(65536);
    for fd in from_fd..capped {
        if fd != keep_fd {
            // SAFETY: closing an fd is safe; EBADF for non-open fds is harmless
            unsafe { libc::close(fd) };
        }
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
