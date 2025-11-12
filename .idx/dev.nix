{ pkgs, ... }: {
  # Enter a shell with the following packages available
  packages = [
    pkgs.nodejs_20
  ];

  # Set environment variables
  env = {
    DATABASE_URL = "postgresql://neondb_owner:npg_kBoNcXG5AD4V@ep-falling-voice-a4wnnvt5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
    # Disable the runtime error overlay
    DISABLE_RUNTIME_ERROR_OVERLAY = "true";
  };

  # Start the application on boot
  idx.previews = {
    enable = true;
    previews = {
      web = {
        command = [ "npm" "run" "dev" ];
        manager = "web";
      };
    };
  };
}
