import * as http from "node:http";
import {app} from "./proxy";

let server =   http.createServer( {}, app );
server.listen( 80 );