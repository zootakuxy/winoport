import * as http from "node:http";
import {app} from "./proxy";
import {ElevateChild} from "kitres/src/core/system/elevate";
import {ElevateRequest} from "./elevate";


function startServer() {
    let server = http.createServer({}, app);
    server.listen(80);
}

export function main( sys:ElevateChild<ElevateRequest> ){
    sys.on( "http", () => {
        startServer();
    });
}

if( require.main.filename === __filename ){
    startServer()
}