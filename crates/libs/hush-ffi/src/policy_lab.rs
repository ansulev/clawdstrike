//! PolicyLab FFI bindings — JSON-in/JSON-out policy synthesis, simulation,
//! OCSF conversion, and timeline generation.

use std::ffi::{c_char, CStr};

use crate::error::{ffi_try, set_last_error};

/// Opaque handle wrapping a `PolicyLabHandle`.
pub struct HushPolicyLabHandle {
    inner: clawdstrike_policy_event::facade::PolicyLabHandle,
}

/// Create a new `PolicyLabHandle` from a policy YAML string.
///
/// Caller must free with `hush_policy_lab_destroy`.
/// Returns `NULL` on error (invalid YAML, etc.).
///
/// # Safety
///
/// `policy_yaml` must be a valid NUL-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn hush_policy_lab_new(
    policy_yaml: *const c_char,
) -> *mut HushPolicyLabHandle {
    crate::error::with_ffi_guard(
        || {
            if policy_yaml.is_null() {
                set_last_error("null pointer");
                return std::ptr::null_mut();
            }
            let c_str = unsafe { CStr::from_ptr(policy_yaml) };
            let s = ffi_try!(c_str.to_str(), std::ptr::null_mut());
            let handle = ffi_try!(
                clawdstrike_policy_event::facade::PolicyLabHandle::new(s),
                std::ptr::null_mut()
            );
            Box::into_raw(Box::new(HushPolicyLabHandle { inner: handle }))
        },
        std::ptr::null_mut(),
    )
}

/// Destroy a `HushPolicyLabHandle`, freeing its memory.
///
/// Passing `NULL` is a no-op.
///
/// # Safety
///
/// `handle` must have been returned by `hush_policy_lab_new`, and must not be
/// used after this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn hush_policy_lab_destroy(handle: *mut HushPolicyLabHandle) {
    crate::error::with_ffi_guard(
        || {
            if !handle.is_null() {
                unsafe {
                    drop(Box::from_raw(handle));
                }
            }
        },
        (),
    );
}

/// Synthesize a policy from observed events (JSONL string).
///
/// Returns a JSON string containing `{ "policy_yaml": "...", "risks": [...] }`.
/// Caller must free with `hush_free_string`.
/// Returns `NULL` on error.
///
/// # Safety
///
/// `events_jsonl` must be a valid NUL-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn hush_policy_lab_synth(events_jsonl: *const c_char) -> *mut c_char {
    crate::error::with_ffi_guard(
        || {
            if events_jsonl.is_null() {
                set_last_error("null pointer");
                return std::ptr::null_mut();
            }
            let c_str = unsafe { CStr::from_ptr(events_jsonl) };
            let s = ffi_try!(c_str.to_str(), std::ptr::null_mut());
            let result = ffi_try!(
                clawdstrike_policy_event::facade::PolicyLabHandle::synth(s),
                std::ptr::null_mut()
            );
            let json = ffi_try!(serde_json::to_string(&result), std::ptr::null_mut());
            crate::string_to_c(json)
        },
        std::ptr::null_mut(),
    )
}

/// Simulate events against a loaded policy.
///
/// Returns a JSON string containing the simulation result.
/// Caller must free with `hush_free_string`.
/// Returns `NULL` on error.
///
/// # Safety
///
/// - `handle` must be a valid `HushPolicyLabHandle` pointer.
/// - `events_jsonl` must be a valid NUL-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn hush_policy_lab_simulate(
    handle: *const HushPolicyLabHandle,
    events_jsonl: *const c_char,
) -> *mut c_char {
    crate::error::with_ffi_guard(
        || {
            if handle.is_null() {
                set_last_error("null pointer");
                return std::ptr::null_mut();
            }
            if events_jsonl.is_null() {
                set_last_error("null pointer");
                return std::ptr::null_mut();
            }
            let handle = unsafe { &*handle };
            let c_str = unsafe { CStr::from_ptr(events_jsonl) };
            let s = ffi_try!(c_str.to_str(), std::ptr::null_mut());
            let result = ffi_try!(handle.inner.simulate(s), std::ptr::null_mut());
            let json = ffi_try!(serde_json::to_string(&result), std::ptr::null_mut());
            crate::string_to_c(json)
        },
        std::ptr::null_mut(),
    )
}

/// Convert events JSONL to OCSF JSONL.
///
/// Caller must free with `hush_free_string`.
/// Returns `NULL` on error.
///
/// # Safety
///
/// `events_jsonl` must be a valid NUL-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn hush_policy_lab_to_ocsf(events_jsonl: *const c_char) -> *mut c_char {
    crate::error::with_ffi_guard(
        || {
            if events_jsonl.is_null() {
                set_last_error("null pointer");
                return std::ptr::null_mut();
            }
            let c_str = unsafe { CStr::from_ptr(events_jsonl) };
            let s = ffi_try!(c_str.to_str(), std::ptr::null_mut());
            let result = ffi_try!(
                clawdstrike_policy_event::facade::PolicyLabHandle::to_ocsf(s),
                std::ptr::null_mut()
            );
            crate::string_to_c(result)
        },
        std::ptr::null_mut(),
    )
}

/// Convert events JSONL to timeline JSONL.
///
/// Caller must free with `hush_free_string`.
/// Returns `NULL` on error.
///
/// # Safety
///
/// `events_jsonl` must be a valid NUL-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn hush_policy_lab_to_timeline(events_jsonl: *const c_char) -> *mut c_char {
    crate::error::with_ffi_guard(
        || {
            if events_jsonl.is_null() {
                set_last_error("null pointer");
                return std::ptr::null_mut();
            }
            let c_str = unsafe { CStr::from_ptr(events_jsonl) };
            let s = ffi_try!(c_str.to_str(), std::ptr::null_mut());
            let result = ffi_try!(
                clawdstrike_policy_event::facade::PolicyLabHandle::to_timeline(s),
                std::ptr::null_mut()
            );
            crate::string_to_c(result)
        },
        std::ptr::null_mut(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::CStr;

    fn sample_event_jsonl() -> std::ffi::CString {
        let event = serde_json::json!({
            "event_id": "evt-ffi-1",
            "event_type": "file_read",
            "timestamp": "2026-03-03T00:00:00Z",
            "data": {
                "type": "file",
                "path": "/tmp/test.txt"
            }
        });
        std::ffi::CString::new(serde_json::to_string(&event).unwrap()).unwrap()
    }

    #[test]
    fn test_synth_returns_json() {
        let events = sample_event_jsonl();
        let ptr = unsafe { hush_policy_lab_synth(events.as_ptr()) };
        assert!(!ptr.is_null());
        let json = unsafe { CStr::from_ptr(ptr) }.to_str().unwrap();
        let v: serde_json::Value = serde_json::from_str(json).unwrap();
        assert!(v.get("policy_yaml").is_some());
        assert!(v.get("risks").is_some());
        unsafe { crate::hush_free_string(ptr) };
    }

    #[test]
    fn test_to_ocsf_returns_json() {
        let events = sample_event_jsonl();
        let ptr = unsafe { hush_policy_lab_to_ocsf(events.as_ptr()) };
        assert!(!ptr.is_null());
        let ocsf = unsafe { CStr::from_ptr(ptr) }.to_str().unwrap();
        assert!(!ocsf.is_empty());
        unsafe { crate::hush_free_string(ptr) };
    }

    #[test]
    fn test_to_timeline_returns_json() {
        let events = sample_event_jsonl();
        let ptr = unsafe { hush_policy_lab_to_timeline(events.as_ptr()) };
        assert!(!ptr.is_null());
        let timeline = unsafe { CStr::from_ptr(ptr) }.to_str().unwrap();
        assert!(!timeline.is_empty());
        unsafe { crate::hush_free_string(ptr) };
    }

    #[test]
    fn test_new_and_destroy() {
        let yaml = std::ffi::CString::new("version: \"1.1.0\"\nname: test\n").unwrap();
        let handle = unsafe { hush_policy_lab_new(yaml.as_ptr()) };
        assert!(!handle.is_null());
        unsafe { hush_policy_lab_destroy(handle) };
    }

    #[test]
    fn test_destroy_null_is_noop() {
        unsafe { hush_policy_lab_destroy(std::ptr::null_mut()) };
    }

    #[test]
    fn test_null_pointer_checks() {
        assert!(unsafe { hush_policy_lab_new(std::ptr::null()) }.is_null());
        assert!(unsafe { hush_policy_lab_synth(std::ptr::null()) }.is_null());
        assert!(unsafe { hush_policy_lab_to_ocsf(std::ptr::null()) }.is_null());
        assert!(unsafe { hush_policy_lab_to_timeline(std::ptr::null()) }.is_null());
        assert!(unsafe { hush_policy_lab_simulate(std::ptr::null(), std::ptr::null()) }.is_null());
    }
}
