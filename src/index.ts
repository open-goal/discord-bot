import { handleRequest } from './routes/router';

export interface Env {
	DISCORD_PUBLIC_KEY: String;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return handleRequest(request, env, ctx);
	},
};
