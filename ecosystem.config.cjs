const appDir = process.env.APP_DIR || "/var/www/ate-trials-app";
const bunBin = process.env.BUN_BIN || "/root/.bun/bin/bun";

module.exports = {
	apps: [
		{
			name: "ate-trials-app",
			cwd: appDir,
			script: bunBin,
			args: "run start",
			interpreter: "none",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			max_memory_restart: "512M",
			env: {
				NODE_ENV: "production",
				HOST: "127.0.0.1",
				PORT: "3000",
				VITE_APP_TITLE: "Trials App",
				DATABASE_URL: `file:${appDir}/main.db`,
			},
		},
	],
};
