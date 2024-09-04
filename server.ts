import {System} from "kitres/src/core/system";
import {IpcPostgresInstanceEvent} from "kitres/src/core/database/instance/ipc-instance";
import Path from "path";
import {ElevatorServer} from "kitres/src/core/system/elevator";
import {ElevateRequest} from "./elevate";

let launcher:ElevatorServer<ElevateRequest> = System.elevateRequire<IpcPostgresInstanceEvent>( Path.join( __dirname, /*language=file-reference*/ "./launcher.js"), {
});

