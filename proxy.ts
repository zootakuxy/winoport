import {createProxyMiddleware, RequestHandler} from "http-proxy-middleware";
import e, {Express} from "express";
import {OnErrorCallback, Options} from "http-proxy-middleware/dist/types";
import moment from "moment";
import fs from "fs";
import fsPath from "path";



type DomainEntry = {
    address: string,
    port: number,
    instant:string,
    protocol:"http"|"https",
    opts: any
}

let proxies:{[p:string]:{
        handler: RequestHandler,
        target: string,
        instant: string
    }} = {};

export const onError: OnErrorCallback = ( err, req1, res1, target1)=>{
    res1.writeHead( 500, {
        'Content-Type': 'text/html',
    } );
    //language=file-reference
    const stream = fs.readFileSync( fsPath.join( __dirname, "./www/error.html", ) );
    res1.end( stream );
}

export function proxyIn( app:Express, proxyProtocol:"http"|"https" ){
    type HeaderOpts = { origin:string, domain:string, port:number, protocol:string, path:string }
    function header ( req:e.Request ): HeaderOpts {
        let protocol = req.protocol;
        let path = req.path;
        let origin = req.headers.host;
        let _origin = origin.split(":");
        let domain = _origin[0];
        let port = Number( _origin.length===2? _origin[1]: proxyProtocol === "http"? 80 : 443 );
        return { protocol, path, origin, domain, port  }
    }

    function nextHandler ( req:e.Request, res:e.Response, next:e.NextFunction, entry:DomainEntry, opts:HeaderOpts ){
        if( !entry ) {
            return next();
        }

        if( !entry.instant ) entry.instant = moment( new Date()).toISOString();
        let protocol:string;
        let port:number;
        if( Number.isSafeInteger(entry[proxyProtocol])){
            port = entry[proxyProtocol];
            protocol = proxyProtocol;
        } else {
            port = entry.port;
            protocol = entry.protocol||proxyProtocol;
        }

        let _port:string = String( port );
        if( protocol === "http" && Number( _port ) === 80 ) _port= "";
        else if( protocol === "https" && Number( _port ) === 443 ) _port=""
        else _port = `:${_port}`;

        let target = `${ protocol }://${ entry.address||"127.0.0.1" }${ _port }`;

        let use = proxies[ target ];

        let _opts:Options = {};
        if( entry.opts ) Object.assign( _opts, entry.opts );
        _opts.target = target;
        _opts.onError = onError

        if( !use ){
            use = {
                handler: createProxyMiddleware( _opts ),
                target: target,
                instant: entry.instant,
            };
            proxies[ target ] = use;
            console.log( "[PROXY:CREATE]", `${opts.protocol}:${opts.domain} ->> ${ target }` )
        }

        if( use.instant !== entry.instant ){
            use.handler = createProxyMiddleware( _opts );
            use.target = target;
            console.log( "[PROXY:UPDATE]", `${opts.protocol}:${opts.domain} ->> ${ target }` )
        }

        use.handler( req, res, next );
    }

    app.use( ( req, res, next)=>{
        if( !req.headers.host ){
            console.log( "Bad Request | No hostname in request!" );
            console.log( "console.log( req.headers ):", req.headers );
            return res.status(400).send('Bad Request');
        }
        let _header:HeaderOpts = header( req );
        // let proxy = proxyOf( _header.domain, req.protocol );
        let entries = require( "./entry.json" );
        let entry = entries[ _header.domain ];
        nextHandler( req, res, next, entry, _header );
    });

    // //Default proxy
    // app.use( ( req, res, next)=>{
    //     if( !req.headers.host ){
    //         console.log( "Bad Request | No hostname in request!" );
    //         console.log( "console.log( req.headers ):", req.headers );
    //         return res.status(400).send('Bad Request');
    //     }
    //     let _header:HeaderOpts = header( req );
    //     let proxy = proxyOfDefault();
    //     nextHandler( req, res, next, proxy, _header );
    // });
}
