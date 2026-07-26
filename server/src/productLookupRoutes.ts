import type { FastifyInstance } from "fastify";
import type { ProductLookup } from "./productLookup.js";

type ProductLookupQuery = {
  query?: string;
};

export function registerProductLookupRoutes(app: FastifyInstance, productLookup: ProductLookup) {
  app.get<{ Querystring: ProductLookupQuery }>("/api/product-lookup", async (request, reply) => {
    const query = request.query.query?.trim() ?? "";
    if (query.length < 2 || query.length > 120) {
      return reply.code(400).send({
        error: "INVALID_PRODUCT_QUERY",
        message: "请输入 2 到 120 个字符的品牌或产品名称。",
      });
    }

    try {
      const candidates = await productLookup(query);
      return { query, candidates };
    } catch (error) {
      request.log.warn({ error, query }, "Product metadata lookup failed.");
      return reply.code(502).send({
        error: "PRODUCT_LOOKUP_UNAVAILABLE",
        message: "暂时无法联网查找产品资料，请稍后重试或继续手动填写。",
      });
    }
  });
}
