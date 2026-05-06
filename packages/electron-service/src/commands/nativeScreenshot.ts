import { createLogger } from '@wdio/native-utils';
import type { ElectronCdpBridge } from '../bridge.js';
import { execute } from './executeCdp.js';

const log = createLogger('electron-service', 'nativeScreenshot');

export async function nativeScreenshot(
  browser: WebdriverIO.Browser,
  cdpBridge: ElectronCdpBridge,
  options?: { windowHandle?: string },
): Promise<Buffer> {
  log.debug('capturing native screenshot', options);

  const base64 = await execute<string, [typeof options]>(
    browser,
    cdpBridge,
    (electron, opts: { windowHandle?: string } | undefined) => {
      const { BrowserWindow } = electron;
      const win = opts?.windowHandle
        ? BrowserWindow.fromId(Number(opts.windowHandle))
        : (BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]);

      if (!win) throw new Error('no Electron BrowserWindow available to capture');

      // biome-ignore lint/style/noCommonJs: this function is serialized and run via CDP callFunctionOn in Electron's CJS main-process context; ESM dynamic import() is unavailable there
      const { spawnSync } = require('node:child_process') as typeof import('node:child_process');
      // biome-ignore lint/style/noCommonJs: same as above
      const { tmpdir } = require('node:os') as typeof import('node:os');
      // biome-ignore lint/style/noCommonJs: same as above
      const { join } = require('node:path') as typeof import('node:path');
      // biome-ignore lint/style/noCommonJs: same as above
      const { readFileSync, unlinkSync } = require('node:fs') as typeof import('node:fs');

      const out = join(tmpdir(), `wdio-native-${Date.now()}.png`);

      if (process.platform === 'darwin') {
        const b = win.getBounds();
        const r = spawnSync('screencapture', ['-x', '-R', `${b.x},${b.y},${b.width},${b.height}`, out]);
        if (r.error) throw r.error;
        if (r.status !== 0) throw new Error(`screencapture failed (exit ${r.status}): ${r.stderr?.toString().trim()}`);
      } else if (process.platform === 'win32') {
        const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0).toString();
        const ps =
          `Add-Type -AssemblyName System.Drawing,System.Windows.Forms; ` +
          `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;` +
          `public class W{[DllImport(\\"user32.dll\\")]public static extern bool PrintWindow(IntPtr h,IntPtr d,uint f);` +
          `[DllImport(\\"user32.dll\\")]public static extern bool GetWindowRect(IntPtr h,out RECT r);` +
          `public struct RECT{public int L,T,R,B;}}'; ` +
          `$h=[IntPtr]${hwnd}; $r=New-Object W+RECT; [W]::GetWindowRect($h,[ref]$r) | Out-Null; ` +
          `$b=New-Object Drawing.Bitmap ($r.R-$r.L),($r.B-$r.T); ` +
          `$g=[Drawing.Graphics]::FromImage($b); ` +
          `[W]::PrintWindow($h,$g.GetHdc(),2) | Out-Null; ` +
          `$b.Save('${out.replace(/\\/g, '/')}', [Drawing.Imaging.ImageFormat]::Png)`;
        const r = spawnSync('powershell', ['-NoProfile', '-Command', ps]);
        if (r.error) throw r.error;
        if (r.status !== 0)
          throw new Error(`PowerShell capture failed (exit ${r.status}): ${r.stderr?.toString().trim()}`);
      } else {
        throw new Error(`nativeScreenshot is not supported on ${process.platform}`);
      }

      const png = readFileSync(out);
      unlinkSync(out);
      return png.toString('base64');
    },
    options,
  );

  return Buffer.from(base64 as string, 'base64');
}
