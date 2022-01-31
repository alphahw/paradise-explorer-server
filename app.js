import express from "express";
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL, sendResult } from "graphql-helix";

import 'dotenv/config';

import fs from 'fs';
let typeDefs;
try {
  typeDefs = fs.readFileSync('./schema.graphql', 'utf8')
  console.log('Loaded typeDefs')
} catch (err) {
  console.error(err)
  process.exit(1)
}

console.log(typeDefs)

import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";

const driver = neo4j.driver(
    process.env.NEO4J_URL,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

const neoSchema = new Neo4jGraphQL({ typeDefs, driver });

const app = express();
app.use(express.json());

app.use("/graphql", async (req, res) => {
  // Create a generic Request object that can be consumed by Graphql Helix's API
  const request = {
    body: req.body,
    headers: req.headers,
    method: req.method,
    query: req.query,
  };

  // Determine whether we should render GraphiQL instead of returning an API response
  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL());
  } else {
    // Extract the Graphql parameters from the request
    const { operationName, query, variables } = getGraphQLParameters(request);

    // debugger;

    // console.log('=== start ===')
    // console.log(operationName,
    //   query,
    //   variables,
    //   request,
    //   neoSchema.schema)
    // console.log('=== end ===')

    // Validate and execute the query
    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema: neoSchema.schema,
    });

    // processRequest returns one of three types of results depending on how the server should respond
    // 1) RESPONSE: a regular JSON payload
    // 2) MULTIPART RESPONSE: a multipart response (when @stream or @defer directives are used)
    // 3) PUSH: a stream of events to push back down the client for a subscription
    // The "sendResult" is a NodeJS-only shortcut for handling all possible types of Graphql responses,
    // See "Advanced Usage" below for more details and customizations available on that layer.

    sendResult(result, res);
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});