import {fork} from "node:child_process";
import Path from "path";
fork( Path.join(__dirname, /*language=file-reference*/ `./http.js`));
fork( Path.join(__dirname, /*language=file-reference*/ `./https.js`));