package co.ceti;

import org.springframework.boot.SpringApplication;

public class TestCetiApplication {

	public static void main(String[] args) {
		SpringApplication.from(CetiApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
