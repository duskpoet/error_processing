mod app;

fn main() {
    let result = std::panic::catch_unwind(|| {
        let config_contents = app::read_config("config.txt");
        println!("Config Contents:\n{}", config_contents);
    });
    match result {
        Ok(_) => println!("Config file read successfully."),
        Err(_) => println!("An error occurred while reading the config file."),
    }
}
