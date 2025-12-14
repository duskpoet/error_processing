use std::fs::File;
use std::io::Read;

pub fn read_config(file_path: &str) -> String {
    let mut file = File::open(file_path).expect("Failed to open config file");
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .expect("Failed to read config file");
    contents
}
