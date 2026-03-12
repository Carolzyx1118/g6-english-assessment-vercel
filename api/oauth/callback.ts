import type { IncomingMessage, ServerResponse } from "node:http";
import runHandler from "../_runHandler";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return runHandler(req, res);
}
