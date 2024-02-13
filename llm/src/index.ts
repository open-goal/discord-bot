import { Ai } from '@cloudflare/ai';
import { handleRequest } from './routes/router';

export interface Env {
	AI: Ai;
	VECTORIZE_INDEX: VectorizeIndex;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return handleRequest(request, env, ctx);
	},
};
