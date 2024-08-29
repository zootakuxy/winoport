import * as fs from "fs";
import {SpawnSyncReturns} from "child_process";
import moment, {Moment} from "moment";
import {CertBot} from "./certbot";

export const SIMPLE_EXAMPLE = new Proxy( {
    status:0,
    stderr: 'Saving debug log to /home/brainsoft/app/prod/noport/var/certificates-logs/letsencrypt.log\n' +
        'Plugins selected: Authenticator webroot, Installer None\n' +
        'Obtaining a new certificate\n' +
        'Performing the following challenges:\n' +
        'http-01 challenge for example.brainsoftstp.com\n' +
        'Using the webroot path /home/brainsoft/app/prod/noport/server/client/public for all unmatched domains.\n' +
        'Waiting for verification...\n' +
        'Cleaning up challenges\n' +
        'Non-standard path(s), might not work with crontab installed by your operating system package manager\n',
    stdout: 'IMPORTANT NOTES:\n' +
        ' - Congratulations! Your certificate and chain have been saved at:\n' +
        '   /home/brainsoft/app/prod/noport/var/certificates/live/example.brainsoftstp.com/fullchain.pem\n' +
        '   Your key file has been saved at:\n' +
        '   /home/brainsoft/app/prod/noport/var/certificates/live/example.brainsoftstp.com/privkey.pem\n' +
        '   Your cert will expire on 2022-03-04. To obtain a new or tweaked\n' +
        '   version of this certificate in the future, simply run certbot\n' +
        '   again. To non-interactively renew *all* of your certificates, run\n' +
        '   "certbot renew"\n' +
        ' - If you like Certbot, please consider supporting our work by:\n' +
        '\n' +
        "   Donating to ISRG / Let's Encrypt:   https://letsencrypt.org/donate\n" +
        '   Donating to EFF:                    https://eff.org/donate-le\n' +
        '\n',
}, {
    set(target: { stdout: string; stderr: string; status: number }, p: string | symbol, value: any, receiver: any): boolean {
        throw  new Error();
    }
})

export type CertificateInfo = {
    domain:string
    success:boolean,
    congratulations?:boolean,
    expiration?:Moment,
    expirationDate?:Moment,
    creation?:Moment,
    availableDays:number

    key?:string,
    cert?:string,
    chain?:string,
    fullChain?:string,
    outputs: CertbotOutputs,
    message?:string,
    error?:Error
}

export function _available ( _cert:CertificateInfo ){
    let _start = moment( moment.now() );
    let _end = moment( _cert.expiration );
    if( !_end ) return -1;
    return moment.duration( _end.diff( _start ) ).asDays();
}


export type CertbotOutputs = {
    status?: number,
    error?: Error,
    output?: string,
    stderr?: string,
    stdout?: string,
    pid?: number,
    signal?: string
}
export function certBotResponseResolver( certBot:CertBot, domain:string, outputs: CertbotOutputs ):CertificateInfo{

    const files = {
        key: certBot.privateKeyOf( domain ),
        cert: certBot.certOf( domain ),
        chain: certBot.fullChainOf( domain ),
        fullChain: certBot.chainOf( domain ),
    }
    const defMSG = {
        congratulations: "Congratulations! Your certificate and chain have been saved".toLowerCase(),
        expiration: "Your cert will expire".toLowerCase()
    }

    let _cert:CertificateInfo = {
        message: outputs.output||outputs.stderr,
        error: outputs.error,
        outputs:outputs,
        domain, success: false,
        get availableDays(){
            return _available( this )
        }
    };

    if( outputs.status !== 0 ) return _cert;
    let resultLines = outputs.stdout.split("\n" )
        .map( value => value.trim() )
        .map( line => {
            let lowers = line.toLowerCase();
            if( lowers.includes( defMSG.congratulations ) )
                return { success:true, congratulations: true }

            if( line === files.fullChain ) return { fullChain: line, fullChainExists: fs.existsSync( line ) }
            if( lowers.includes( defMSG.expiration ) ) {
                let extract = line.match( /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))/ );
                let expiration =  extract[1];
                let expirationDate = null;
                if( expiration ) expirationDate = new Date( expirationDate );
                return { expiration, expirationDate  };
            }
        }).filter( value => !!value )
        .reduce( (previousValue, currentValue) => {
            return Object.assign( previousValue || {}, currentValue );
        });
    return Object.assign( _cert, {success: true, creation: new Date() },  resultLines, files );
}





