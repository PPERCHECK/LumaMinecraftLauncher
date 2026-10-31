import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),seven=path.resolve('node_modules/electron-winstaller/vendor/7z.exe');
const outputs=path.resolve('../../outputs'),stage=path.resolve('../delivery-source'),source=path.join(stage,'luma-source');
fs.mkdirSync(outputs,{recursive:true});fs.mkdirSync(source,{recursive:true});
for(const dir of ['src','electron','scripts','tests','build'])fs.cpSync(dir,path.join(source,dir),{recursive:true});
for(const name of ['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore','LICENSE','README.md','ARCHITECTURE.md','VERIFICATION.md'])fs.copyFileSync(name,path.join(source,name));
for(const name of ['README.md','ARCHITECTURE.md','VERIFICATION.md'])fs.copyFileSync(name,path.join(outputs,name));
fs.copyFileSync('../home-preview.png',path.join(outputs,'Luma-preview.png'));
fs.writeFileSync('release/win-unpacked/START-HERE.txt','Luma Launcher 0.1.0 — Windows x64\r\n\r\nРаспакуйте весь архив и запустите Luma Launcher.exe.\r\nДобавьте локальный профиль по нику, создайте сборку и нажмите «Играть».\r\nJava и Minecraft устанавливаются автоматически.\r\nMicrosoft, Ely.by и CurseForge требуют ваших ключей в настройках.\r\nПодробности и ограничения — в README.md в комплекте исходников.\r\n');
execFileSync(seven,['a','-tzip','-mx=5',path.join(outputs,'Luma-Launcher-Windows-x64.zip'),'.\\*'],{cwd:path.resolve('release/win-unpacked'),stdio:'pipe',windowsHide:true});
execFileSync(seven,['a','-tzip','-mx=7',path.join(outputs,'Luma-Launcher-Source.zip'),'luma-source'],{cwd:stage,stdio:'pipe',windowsHide:true});
for(const file of ['Luma-Launcher-Windows-x64.zip','Luma-Launcher-Source.zip'])console.log(file,(fs.statSync(path.join(outputs,file)).size/1024/1024).toFixed(1)+' MB');

