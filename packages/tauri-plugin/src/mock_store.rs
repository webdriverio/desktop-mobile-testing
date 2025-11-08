use std::collections::HashMap;
use serde_json::Value as JsonValue;
use crate::models::MockConfig;

/// Thread-safe mock registry for storing command mocks
pub struct MockStore {
    mocks: HashMap<String, MockConfig>,
    original_handlers: HashMap<String, JsonValue>, // Store original command handlers if needed
}

impl MockStore {
    pub fn new() -> Self {
        Self {
            mocks: HashMap::new(),
            original_handlers: HashMap::new(),
        }
    }

    pub fn set_mock(&mut self, command: String, config: MockConfig) {
        self.mocks.insert(command, config);
    }

    pub fn get_mock(&self, command: &str) -> Option<&MockConfig> {
        self.mocks.get(command)
    }

    pub fn clear_mocks(&mut self) {
        self.mocks.clear();
    }

    pub fn reset_mocks(&mut self) {
        self.mocks.clear();
        self.original_handlers.clear();
    }

    #[allow(dead_code)]
    pub fn remove_mock(&mut self, command: &str) -> Option<MockConfig> {
        self.mocks.remove(command)
    }

    #[allow(dead_code)]
    pub fn get_all_mocks(&self) -> &HashMap<String, MockConfig> {
        &self.mocks
    }
}

