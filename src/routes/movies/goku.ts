import {
    FastifyRequest,
    FastifyReply,
    FastifyInstance,
    RegisterOptions,
} from "fastify";
import { MOVIES } from "@consumet/extensions";
import { StreamingServers } from "@consumet/extensions/dist/models";

import cache from "../../utils/cache";
import { redis } from "../../main";
import { Redis } from "ioredis";

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
    const goku = new MOVIES.Goku();
    fastify.get("/", (_, rp) => {
        rp.status(200).send({
            intro:
                "Welcome to the goku provider: check out the provider's website @ https://goku.sx",
            routes: ['/:query', '/info', '/watch','/recent-shows','/recent-movies','/trending','/servers','/country','/genre'],
            documentation: "https://docs.consumet.org/#tag/goku",
        });
    });

    fastify.get(
        "/:query",
        async (request: FastifyRequest, reply: FastifyReply) => {
            const query = decodeURIComponent(
                (request.params as { query: string }).query
            );

            const page = (request.query as { page: number }).page;

            let res = redis
                ? await cache.fetch(
                    redis as Redis,
                    `goku:${query}:${page}`,
                    async () => await goku.search(query, page ? page : 1),
                    60 * 60 * 6
                )
                : await goku.search(query, page ? page : 1);

            reply.status(200).send(res);
        }
    );

    fastify.get(
        "/recent-shows",
        async (request: FastifyRequest, reply: FastifyReply) => {
            let res = redis
                ? await cache.fetch(
                    redis as Redis,
                    `goku:recent-shows`,
                    async () => await goku.fetchRecentTvShows(),
                    60 * 60 * 3
                )
                : await goku.fetchRecentTvShows();

            reply.status(200).send(res);
        }
    );

    fastify.get(
        "/recent-movies",
        async (request: FastifyRequest, reply: FastifyReply) => {
            let res = redis
                ? await cache.fetch(
                    redis as Redis,
                    `goku:recent-movies`,
                    async () => await goku.fetchRecentMovies(),
                    60 * 60 * 3
                )
                : await goku.fetchRecentMovies();

            reply.status(200).send(res);
        }
    );

    fastify.get(
        "/trending",
        async (request: FastifyRequest, reply: FastifyReply) => {
            const type = (request.query as { type: string }).type;
            try {
                if (!type) {
                    const res = {
                        results: [
                            ...(await goku.fetchTrendingMovies()),
                            ...(await goku.fetchTrendingTvShows()),
                        ],
                    };
                    return reply.status(200).send(res);
                }

                let res = redis
                    ? await cache.fetch(
                        redis as Redis,
                        `goku:trending:${type}`,
                        async () =>
                            type === "tv"
                                ? await goku.fetchTrendingTvShows()
                                : await goku.fetchTrendingMovies(),
                        60 * 60 * 3
                    )
                    : type === "tv"
                        ? await goku.fetchTrendingTvShows()
                        : await goku.fetchTrendingMovies();

                reply.status(200).send(res);
            } catch (error) {
                reply.status(500).send({
                    message:
                        "Something went wrong. Please try again later. or contact the developers.",
                });
            }
        }
    );

    fastify.get("/info", async (request: FastifyRequest, reply: FastifyReply) => {
        const id = (request.query as { id: string }).id;

        if (typeof id === "undefined")
            return reply.status(400).send({
                message: "id is required",
            });

        try {
            let res = redis
                ? await cache.fetch(
                    redis as Redis,
                    `goku:info:${id}`,
                    async () => await goku.fetchMediaInfo(id),
                    60 * 60 * 3
                )
                : await goku.fetchMediaInfo(id);

            reply.status(200).send(res);
        } catch (err) {
            reply.status(500).send({
                message:
                    "Something went wrong. Please try again later. or contact the developers.",
            });
        }
    });

    fastify.get(
        "/watch",
        async (request: FastifyRequest, reply: FastifyReply) => {
            const episodeId = (request.query as { episodeId: string }).episodeId;
            const mediaId = (request.query as { mediaId: string }).mediaId;
            const server = (request.query as { server: StreamingServers }).server;
            if (typeof episodeId === "undefined")
                return reply.status(400).send({ message: "episodeId is required" });
            if (typeof mediaId === "undefined")
                return reply.status(400).send({ message: "mediaId is required" });

            if (server && !Object.values(StreamingServers).includes(server))
                return reply.status(400).send({ message: "Invalid server query" });

            try {
                let res = redis
                    ? await cache.fetch(
                        redis as Redis,
                        `goku:watch:${episodeId}:${mediaId}:${server}`,
                        async () =>
                            await goku.fetchEpisodeSources(episodeId, mediaId, server),
                        60 * 30
                    )
                    : await goku.fetchEpisodeSources(episodeId, mediaId, StreamingServers.VidCloud);
                reply.status(200).send(res);
            } catch (err) {
                reply
                    .status(500)
                    .send({ message: "Something went wrong. Please try again later." });
            }
        }
    );

    fastify.get(
        "/servers",
        async (request: FastifyRequest, reply: FastifyReply) => {
            const episodeId = (request.query as { episodeId: string }).episodeId;
            const mediaId = (request.query as { mediaId: string }).mediaId;
            try {
                let res = redis
                    ? await cache.fetch(
                        redis as Redis,
                        `goku:servers:${episodeId}:${mediaId}`,
                        async () => await goku.fetchEpisodeServers(episodeId, mediaId),
                        60 * 30
                    )
                    : await goku.fetchEpisodeServers(episodeId, mediaId);

                reply.status(200).send(res);
            } catch (error) {
                reply.status(500).send({
                    message:
                        "Something went wrong. Please try again later. or contact the developers.",
                });
            }
        }
    );

    fastify.get('/country/:country', async (request: FastifyRequest, reply: FastifyReply) => {
        const country = (request.params as { country: string }).country;
        const page = (request.query as { page: number }).page ?? 1;
        try {
          let res = redis
            ? await cache.fetch(
              redis as Redis,
              `goku:country:${country}:${page}`,
              async () => await goku.fetchByCountry(country, page),
              60 * 60 * 3,
            )
            : await goku.fetchByCountry(country, page);
    
          reply.status(200).send(res);
        } catch (error) {
          reply.status(500).send({
            message:
              'Something went wrong. Please try again later. or contact the developers.',
          });
        }
      });
    
    
    fastify.get('/genre/:genre', async (request: FastifyRequest, reply: FastifyReply) => {
      const genre = (request.params as { genre: string }).genre;
      const page = (request.query as { page: number }).page ?? 1;
      try {
        let res = redis
          ? await cache.fetch(
            redis as Redis,
            `goku:genre:${genre}:${page}`,
            async () => await goku.fetchByGenre(genre, page),
            60 * 60 * 3,
          )
          : await goku.fetchByGenre(genre, page);
    
        reply.status(200).send(res);
      } catch (error) {
        reply.status(500).send({
          message:
            'Something went wrong. Please try again later. or contact the developers.',
        });
      }
    });
};

export default routes;
