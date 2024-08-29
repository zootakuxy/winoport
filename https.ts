import https from "https";
import {CertBot} from "./certbot";
import Path from "path";
import express from "express";
import {proxyIn} from "./proxy";

const certBot = new CertBot( {
    dirs: {
        configs: "C:\\Certbot",
        work: "C:\\Certbot\\work",
        logs: "C:\\Certbot\\workLogs",
        webroot: Path.join( __dirname, /*language=file-reference*/ "./www"),
        response: "C:\\Certbot\\workResponse",
    }, email: "danielcarvalho555@gmail.com"
});

const  app = express();

let server =   https.createServer( {
    async SNICallback( domain, callback ){
        let exists = certBot.exists( domain );
        console.log( "context of domain exists?", "domain", domain, "exists?", exists );
        let loadDomain = ()=>{
            certBot.loadContextOf( domain ).then( ctxResponse => {
                console.log( "get context certificate to domain", domain, ctxResponse.result )
                if( ctxResponse.result ) callback( null, ctxResponse.context );
                else{
                    console.log( ctxResponse.message );
                    callback( ctxResponse.error|| new Error( ctxResponse.message ) );
                }
            })
        }

        if( exists ){
            loadDomain()
        } else  {
            callback( new Error( `Não foi encontrado nenhum SSL para o dominio requisitado!` ) );
        }
    }
}, app );


proxyIn( app, "https" );
server.listen( 443 );