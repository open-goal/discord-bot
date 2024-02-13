import { Env } from '..';
import { Router } from 'itty-router';
import { BulkVectorizeQuestions, PromptWithContext, QueryForSimilarQuestions } from './llm/llm';

const routerV2 = Router();

routerV2
	.get('/llm/bulkVectorizeQuestions', BulkVectorizeQuestions)
	.post('/llm/queryForSimilarQuestions', QueryForSimilarQuestions)
	.post('/llm/promptWithContext', PromptWithContext)
	.get('*', () => new Response('Not found', { status: 404 }));

export const handleRequest = (request: Request, env: Env, ctx: ExecutionContext) => routerV2.handle(request, env, ctx);
