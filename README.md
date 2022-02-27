# Development

### Install nodejs
Make sure nodejs is installed
```
node --version
```
If not, I recommend [Node Version Manager (nvm)](https://github.com/nvm-sh/nvm#readme)
Then use nvm to make sure you are using the latest LTS version
```
nvm install --lts
```

```
nvm use --lts
```

### Install development dependencies
In the root directory of the project type
```
npm i
```

### Ready to code
In the root directory of the project type
```
npm run dev
```
open browser to [http://localhost:3000/](http://localhost:3000/)
change files in your code editor of choice and the webpage will reload on save of files in the src folder.

If you get an error that port 8080 is still in use, you can kill the process with this command
```
npx kill-port 8080
```
after that you should be able to start the development script with
```
npm run dev
```

### Build
```
npm run build
```
builds the output html file to the dist directory for distribution

### Test
```
npm test
```
Should run tests when written (TODO)