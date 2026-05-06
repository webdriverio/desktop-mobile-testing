import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '@wdio/native-utils';
import type { ElectronCdpBridge } from '../bridge.js';
import { execute } from './executeCdp.js';

const log = createLogger('electron-service', 'nativeScreenshot');

type WindowInfo = {
  bounds: { x: number; y: number; width: number; height: number };
  nativeHandle?: string;
};

export async function nativeScreenshot(
  browser: WebdriverIO.Browser,
  cdpBridge: ElectronCdpBridge,
  options?: { windowHandle?: string },
): Promise<Buffer> {
  log.debug('capturing native screenshot', options);

  const result = await execute<WindowInfo, [typeof options]>(
    browser,
    cdpBridge,
    (electron, opts) => {
      const { BrowserWindow } = electron;
      const win = opts?.windowHandle
        ? BrowserWindow.fromId(Number(opts.windowHandle))
        : (BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]);

      if (!win) throw new Error('no Electron BrowserWindow available to capture');

      const bounds = win.getBounds();
      // readBigUInt64LE interprets the Buffer as a little-endian 64-bit integer, matching
      // the x64 Windows in-memory HWND layout. toString() yields the decimal value PowerShell
      // needs for [IntPtr]cast. toString('hex') would emit raw bytes in LE order and then
      // BigInt('0x...') would reinterpret them as big-endian, producing a wrong handle.
      const nativeHandle =
        process.platform === 'win32' ? win.getNativeWindowHandle().readBigUInt64LE(0).toString() : undefined;

      return { bounds, nativeHandle };
    },
    options,
  );

  if (!result || Array.isArray(result)) throw new Error('unexpected result from CDP execute');
  const windowInfo = result;

  const out = join(tmpdir(), `wdio-native-${Date.now()}.png`);

  if (process.platform === 'darwin') {
    const { x, y, width, height } = windowInfo.bounds;
    const r = spawnSync('screencapture', ['-x', '-R', `${x},${y},${width},${height}`, out], { timeout: 10_000 });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`screencapture failed (exit ${r.status}): ${r.stderr?.toString().trim()}`);
  } else if (process.platform === 'win32') {
    const hwnd = windowInfo.nativeHandle!;
    const outFwd = out.replace(/\\/g, '/');
    // CopyFromScreen captures from the GDI screen surface using the window's physical rect.
    // PrintWindow(PW_RENDERFULLCONTENT) requires DWM composition and deadlocks on CI runners.
    const ps =
      `Add-Type -AssemblyName System.Drawing,System.Windows.Forms; ` +
      `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;` +
      `public class W{[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);` +
      `public struct RECT{public int L,T,R,B;}}'; ` +
      `$h=[IntPtr]${hwnd}; $r=New-Object W+RECT; [W]::GetWindowRect($h,[ref]$r) | Out-Null; ` +
      `$w=$r.R-$r.L; $ht=$r.B-$r.T; ` +
      `$b=New-Object Drawing.Bitmap $w,$ht; ` +
      `$g=[Drawing.Graphics]::FromImage($b); ` +
      `$g.CopyFromScreen($r.L,$r.T,0,0,(New-Object Drawing.Size $w,$ht)); ` +
      `$g.Dispose(); ` +
      `$b.Save('${outFwd}',[Drawing.Imaging.ImageFormat]::Png)`;
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { timeout: 30_000 });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`PowerShell capture failed (exit ${r.status}): ${r.stderr?.toString().trim()}`);
  } else {
    throw new Error(`nativeScreenshot is not supported on ${process.platform}`);
  }

  try {
    return readFileSync(out);
  } finally {
    unlinkSync(out);
  }
}
