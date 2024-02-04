import { Env } from '..';
import { DiscordHandler } from './discord/discord';
import { Router } from 'itty-router';

const routerV2 = Router();

routerV2.post('/discord/command', DiscordHandler).get('*', () => new Response('Not found', { status: 404 }));

export const handleRequest = (request: Request, env: Env, ctx: ExecutionContext) => routerV2.handle(request, env, ctx);
