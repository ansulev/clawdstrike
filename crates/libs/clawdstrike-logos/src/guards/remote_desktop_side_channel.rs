//! Formula translation for [`RemoteDesktopSideChannelConfig`].

use clawdstrike::guards::RemoteDesktopSideChannelConfig;
use logos_ffi::{AgentId, Formula};

use super::{custom_permission, custom_prohibition, GuardFormulas};

impl GuardFormulas for RemoteDesktopSideChannelConfig {
    fn to_formulas(&self, agent: &AgentId) -> Vec<Formula> {
        if !self.enabled {
            return vec![];
        }

        let mut formulas = vec![custom_permission(
            agent,
            "guard:remote_desktop_side_channel:enabled",
        )];

        for (channel, enabled) in [
            ("clipboard", self.clipboard_enabled),
            ("file_transfer", self.file_transfer_enabled),
            ("session_share", self.session_share_enabled),
            ("audio", self.audio_enabled),
            ("drive_mapping", self.drive_mapping_enabled),
            ("printing", self.printing_enabled),
        ] {
            let atom = format!("remote_desktop_side_channel:channel:{channel}");
            formulas.push(if enabled {
                custom_permission(agent, atom)
            } else {
                custom_prohibition(agent, atom)
            });
        }

        if let Some(limit) = self.max_transfer_size_bytes {
            formulas.push(custom_prohibition(
                agent,
                format!("remote_desktop_side_channel:file_transfer:size_exceeds:{limit}"),
            ));
        }

        formulas
    }
}
