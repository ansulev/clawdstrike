//! Guard-based supervisor backend for nono.
//!
//! Routes nono [`CapabilityRequest`]s through ClawdStrike's [`HushEngine`]
//! for real-time guard-based allow/deny decisions. The supervisor runs on a
//! dedicated OS thread (not in the async runtime) and uses `block_in_place`
//! to bridge into the tokio runtime for async guard evaluation.

use std::sync::Arc;

use nono::supervisor::{ApprovalBackend, ApprovalDecision, CapabilityRequest};
use nono::Result as NonoResult;

use crate::engine::HushEngine;
use crate::guards::{GuardAction, GuardContext};

/// Supervisor backend that routes capability requests through ClawdStrike guards.
///
/// Each [`CapabilityRequest`] from the sandboxed child is translated into a
/// [`GuardAction::FileAccess`] and evaluated by the [`HushEngine`]. The engine
/// runs all configured guards (ForbiddenPathGuard, PathAllowlistGuard, etc.)
/// and returns an aggregated verdict.
pub struct GuardSupervisorBackend {
    engine: Arc<HushEngine>,
    context: GuardContext,
}

impl GuardSupervisorBackend {
    pub fn new(engine: Arc<HushEngine>, context: GuardContext) -> Self {
        Self { engine, context }
    }
}

impl ApprovalBackend for GuardSupervisorBackend {
    fn request_capability(&self, request: &CapabilityRequest) -> NonoResult<ApprovalDecision> {
        let path = request.path.to_string_lossy();

        // Bridge from the synchronous supervisor thread into the async tokio
        // runtime. `block_in_place` is safe here because the supervisor loop
        // runs on a dedicated OS thread spawned via `std::thread::spawn`, not
        // on a tokio worker thread.
        let result = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                self.engine
                    .check_action(&GuardAction::FileAccess(&path), &self.context)
                    .await
            })
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
