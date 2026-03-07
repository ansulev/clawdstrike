//! Guard-based supervisor backend for nono.
//!
//! Routes nono [`CapabilityRequest`]s through ClawdStrike's [`HushEngine`]
//! for real-time guard-based allow/deny decisions. The supervisor runs on a
//! dedicated OS thread and uses a captured Tokio handle to evaluate async
//! guards from that thread.

use std::sync::Arc;

use nono::supervisor::{ApprovalBackend, ApprovalDecision, CapabilityRequest};
use nono::Result as NonoResult;

use crate::engine::HushEngine;
use crate::guards::{GuardAction, GuardContext};

/// Supervisor backend that routes capability requests through ClawdStrike guards.
///
/// Each [`CapabilityRequest`] from the sandboxed child is translated into the
/// closest matching filesystem guard action and evaluated by the [`HushEngine`].
/// Read requests stay as [`GuardAction::FileAccess`], while write/read+write
/// requests use [`GuardAction::FileWrite`] so allowlist and forbidden-path
/// policies preserve their read-vs-write semantics.
///
/// The `runtime_handle` is captured from the caller's Tokio context before the
/// supervisor thread is spawned, because `std::thread::spawn` threads do NOT
/// inherit the Tokio runtime thread-local.
pub struct GuardSupervisorBackend {
    engine: Arc<HushEngine>,
    context: GuardContext,
    runtime_handle: tokio::runtime::Handle,
}

impl GuardSupervisorBackend {
    pub fn new(
        engine: Arc<HushEngine>,
        context: GuardContext,
        runtime_handle: tokio::runtime::Handle,
    ) -> Self {
        Self {
            engine,
            context,
            runtime_handle,
        }
    }
}

impl ApprovalBackend for GuardSupervisorBackend {
    fn request_capability(&self, request: &CapabilityRequest) -> NonoResult<ApprovalDecision> {
        let path = request.path.to_string_lossy();
        static EMPTY_WRITE: &[u8] = &[];

        let result = self.runtime_handle.block_on(async {
            let action = match request.access {
                nono::AccessMode::Read => GuardAction::FileAccess(&path),
                nono::AccessMode::Write | nono::AccessMode::ReadWrite => {
                    GuardAction::FileWrite(&path, EMPTY_WRITE)
                }
            };
            self.engine.check_action(&action, &self.context).await
        });

        match result {
            Ok(guard_result) => {
                if guard_result.allowed {
                    Ok(ApprovalDecision::Granted)
                } else {
                    Ok(ApprovalDecision::Denied {
                        reason: guard_result.message,
                    })
                }
            }
            Err(e) => Ok(ApprovalDecision::Denied {
                reason: format!("Guard evaluation error: {e}"),
            }),
        }
    }

    fn backend_name(&self) -> &str {
        "clawdstrike-guard-supervisor"
    }
}
