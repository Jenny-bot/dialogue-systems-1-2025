# dialogue-systems-1-2025

## How to deploy your app
1.  Use SSH to login to eduserv.
2.  Create a folder in `/srv/www/` with the same name as your gus-account, e.g. `gusxxxxxx`.
3.  Build your app: `yarn build --base=gusxxxxxx`, this will produce a `dist` directory with a few files in it. (More information can be found in [Vite documentation](https://vitejs.dev/guide/build.html)). 
    - If you are getting errors, you might consider excluding some of your files in `tsconfig.json` (i.e. `"exclude": ["src/dmParallel.ts", "src/dm2.ts"]`)
4.  Copy the contents of this directory to your folder on the server:
    
        scp -r dist/* eduserv:/srv/www/gusxxxxxx/
5.  Access your app at <https://eduserv.flov.gu.se:9000/gusxxxxxx> (protected by password).

Note: in some cases, the access rights are incorrectly set. In this case you are likely to see the HTML page but other code won’t load. In this case run the following command in your `/srv/www/gusxxxxxx/` directory:
    
    chmod -R a+rX assets
