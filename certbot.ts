import fs from "fs";
import {spawn} from "child_process";
import path from "path";
import * as tls from "tls";
import {SecureContext} from "tls";
import * as os from "os";
import {CertificateInfo, certBotResponseResolver, CertbotOutputs, _available} from "./resolver";
import moment from "moment";
import Path from "path";

export type CertbotOpts = {
    email:string,
    dirs:{
        logs:string,
        work:string,
        configs:string
        webroot:string,
        response:string
    }
};

export type ContextResponse = CertbotOutputs & {
    result:boolean,
    message?:string,
    context?: SecureContext,
    error?:Error
}

export function readFilePromise( fileName:string ):Promise<{data:Buffer, error:Error}>{
    return new Promise( (resolve) => {
        fs.readFile( fileName, (error, data) => {
            return resolve( {data, error });
        })
    });
}

export class CertBot {
    private _opts:CertbotOpts;

    constructor(opts:CertbotOpts) {
        this._opts = opts;
        Object.values( this._opts.dirs ).forEach( value => fs.mkdirSync( value, { recursive: true } ) );
        const self = this;

        const _minDays = 10
        let _reject = ( message:string )=>{
            console.log(`[certproxy] ${ message }`)
        };
        let  _scan = ()=>{

            setTimeout( ()=>{
                console.log( "PROUCURANDO PELOS CERTIFICADOS PROXIMO DE EXPIRAÇÃO" );
                self.list().forEach( domain =>  {
                    console.log( `Check availableDays for certificate ${ domain } ...!`)
                    let _cert = self.certificateOf( domain );
                    if( !_cert ) return _reject( `Cannot load certificate info for ${ domain }` );
                    if( _cert.availableDays >= _minDays ) return _reject( `Certificado dentro do prasao saltar!` );
                    self.remove( domain ).then( value => {
                        if( value.status === 0 ) console.log( `[CERTBOT] certificado para ${ domain } eliminado. Restando ${ _cert.availableDays } dias para expiração` );
                        else console.log( value.output );
                    })
                });
                _scan();
            }, 1000 * 60 * 60 *12 );
        }
        _scan();
    }

    liveOf ( domain:string ){
        return path.join( this._opts.dirs.configs, "live", domain );
    } archiveOf( domain:string ){
        return path.join( this._opts.dirs.configs, "archive", domain );
    } privateKeyOf( domain:string ){
        return path.join( this.liveOf( domain ), 'privkey.pem' )
    } chainOf( domain:string ){
        return path.join( this.liveOf( domain ), 'chain.pem' )
    } certOf( domain:string ){
        return path.join( this.liveOf( domain ), 'cert.pem' )
    } fullChainOf( domain:string ){
        return path.join( this.liveOf( domain ), 'fullchain.pem' )
    } responseOf( domain:string ){
        return path.join( this._opts.dirs.response, `${domain}.json` )
    } exists( domain:string ){
        console.log( domain, this.liveOf( domain ), {
            privateKeyOf: fs.existsSync(this.privateKeyOf(domain)),
            // chainOf: fs.existsSync(this.chainOf(domain)),
            // fullChainOf: fs.existsSync(this.fullChainOf(domain)),
            // certOf: fs.existsSync(this.certOf(domain)),
        })
        return fs.existsSync(this.privateKeyOf(domain))
            // && fs.existsSync(this.chainOf(domain))
            // && fs.existsSync(this.fullChainOf(domain))
            // && fs.existsSync(this.certOf(domain))

    } remove( domain:string ):Promise<CertbotOutputs>{
        console.log( `Removing certificate of ${ domain }...!` );
        return new Promise( resolve => {
            const args = [
                "delete",
                "--config-dir", this._opts.dirs.configs,
                "--logs-dir", this._opts.dirs.logs,
                "--work-dir",  this._opts.dirs.work,
                "--cert-name", domain
            ];

            console.log( "HOME:", os.homedir() );
            console.log( "USER:", os.userInfo().username, args.join( " " ) );
            console.log( "CWD:", process.cwd() );
            console.log( "COMMAND:", "certbot", args.join( " " ) );
            const child = spawn("certbot", args, {
                timeout: 1000 * 15
            });

            const outputs:{
                stdout:Buffer[],
                stderr:Buffer[],
                output:Buffer[],
                error?:Error,
                code?:number
            } = {
                stdout:[],
                stderr:[],
                output:[]
            }
            child.stdout.on( "data", chunk => {
                outputs.stdout.push( chunk );
                outputs.output.push( chunk );
            });

            child.stderr.on( "data", chunk => {
                outputs.stderr.push( chunk )
                outputs.output.push( chunk )
            });

            child.on( "error", err => {
                outputs.error = err;
            });


            child.on( "exit", (code, signal) => {
                outputs.code = code;
                return resolve({
                    status: outputs.code,
                    output: Buffer.concat( outputs.output ).toString(),
                    stderr: Buffer.concat( outputs.stderr ).toString(),
                    stdout: Buffer.concat( outputs.stdout ).toString(),
                    error: outputs.error,
                    pid: child.pid,
                    signal: signal
                } );
            });
            if ( fs.existsSync( this.responseOf( domain ) ) ) {
                fs.unlink( this.responseOf( domain), err => {
                    if( err ){
                        console.log(`[cetproxy] Error ao remover o arquivo do response of ${ domain }! Error = "${err.name}"`)
                        console.error( err );
                    }
                });
            }
        })
    } generateCert( domain:string ): Promise<CertificateInfo>{

        return new Promise( resolve => {
            let _responser = ()=>{
                const args = [
                    "certonly",
                    "--config-dir", this._opts.dirs.configs,
                    "--logs-dir", this._opts.dirs.logs,
                    "--work-dir",  this._opts.dirs.work,
                    "-d", domain,
                    "--webroot",
                    "--agree-tos",
                    "-m", this._opts.email,
                    "--webroot-path", this._opts.dirs.webroot,
                ];

                console.log( "HOME:", os.homedir() );
                console.log( "USER:", os.userInfo().username, args.join( " " ) );
                console.log( "CWD:", process.cwd() );
                console.log( "COMMAND:", "certbot", args.join( " " ) );
                const child = spawn("certbot", args, {
                    timeout: 1000 * 15
                });

                const outputs:{
                    stdout:Buffer[],
                    stderr:Buffer[],
                    output:Buffer[],
                    error?:Error,
                    code?:number
                } = {
                    stdout:[],
                    stderr:[],
                    output:[]
                }
                child.stdout.on( "data", chunk => {
                    outputs.stdout.push( chunk );
                    outputs.output.push( chunk );
                });

                child.stderr.on( "data", chunk => {
                    outputs.stderr.push( chunk )
                    outputs.output.push( chunk )
                });

                child.on( "error", err => {
                    outputs.error = err;
                });

                child.on( "exit", (code, signal) => {
                    outputs.code = code;

                    let response = certBotResponseResolver( this, domain, {
                        stdout: Buffer.concat( outputs.stdout ).toString(),
                        stderr: Buffer.concat( outputs.stderr ).toString(),
                        error: outputs.error,
                        status: outputs.code,
                        output: Buffer.concat( outputs.output ).toString(),
                        pid: child.pid,
                        signal: signal
                    });

                    console.log( response.outputs.output );

                    if( response.success ){
                        this.saveResponseOf( domain, response );
                    }

                    return resolve( response );
                });
            }

            let _next = ()=>{
                let list = [];
                let pattern = new RegExp("^" + domain.replace(/\./g, "\\.") + "-\\d{4}$");
                fs.readdirSync( Path.join( this._opts.dirs.configs, "live" ) )
                    .forEach( filename => {
                        let stat = fs.statSync( Path.join( this._opts.dirs.configs, "live", filename ) );
                        if( !stat.isDirectory() ) return;
                        if( !pattern.test( filename ) ) return;
                        list.push( this.remove( filename ) );
                    });

                if( list.length ){
                    Promise.all( list ).then( value => {
                        _responser()
                    }).catch( reason => {
                        _responser();
                    });
                    return;
                }
                _responser();

            }
            if( this.exists( domain ) ){
                this.remove( domain ).then( value => _next() )
                    .catch( reason => {
                        console.log( reason );
                        _next();
                    });
            } else {
                _next();
            }


        })
    }
    loadContextOf( domain:string ):Promise<{
        result:boolean,
        message?:string,
        context?: SecureContext,
        error?:Error
    }>{
        return new Promise( (resolve) => {
            if( !this.exists( domain ) ) return  resolve({
                result: false,
                message: `NO SSL found for domain "${domain}"`
            });

            Promise.all([
                readFilePromise( this.privateKeyOf( domain ) ),
                readFilePromise( this.chainOf( domain ) ),
                readFilePromise( this.certOf( domain ) )
            ]).then( value => {
                let [ key, ca, cert ] = value;
                if( key.error ) return resolve({ result: false, message: key.error?.message });
                if( ca.error ) return resolve({ result: false, message: ca.error?.message });
                if( cert.error ) return resolve({ result: false, message: cert.error?.message });

                const context = tls.createSecureContext({
                    key: key.data,
                    ca: ca.data,
                    cert: cert.data
                });
                return  resolve({  context: context, result: true });
            });
        })
    }

    saveResponseOf( domain:string, response:CertificateInfo ){
        fs.writeFileSync( this.responseOf( domain ), JSON.stringify( response, null, 2 ) );
    }

    list():string[]{
        let certificates: string[] = [];
        fs.readdirSync( this._opts.dirs.response ).forEach( value => {
            let _paths = value.split( "." );
            if( _paths.pop() !== "json" ) return;
            certificates.push( _paths.join( "." ) );
        });
        return certificates;
    }

    certificateOf( domain:string|CertificateInfo ):CertificateInfo{
        if( typeof domain !== "string" ) return domain;

        let certificate:CertificateInfo;
        let file = path.join( this._opts.dirs.response, `${domain}.json` );
        if( !fs.existsSync( file ) ) return null;
        try {
            let document:string = fs.readFileSync( file, { encoding: "utf-8" } ).toString().trim();
            certificate = {
                ... JSON.parse( document ),
            };
            if( certificate.expirationDate ) certificate.expirationDate = moment( certificate.expirationDate );
            if( certificate.expiration ){
                certificate.expiration = moment( certificate.expiration );
                certificate.availableDays = moment.duration( certificate.expiration.diff( moment() ) ).asDays();
            }
            if( certificate.creation ) certificate.creation = moment( certificate.creation );
            certificate.domain = domain;
        } catch (e) {
            console.error( `Erro ao carregar o certificado `, e );
            // if( fs.existsSync( file )) fs.unlinkSync( file );
            return  null
        }
        return certificate;
    }
}
