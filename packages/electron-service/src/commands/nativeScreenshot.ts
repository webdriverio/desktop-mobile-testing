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
  gpuCompositing?: boolean;
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
      const gpuCompositing =
        process.platform === 'win32' ? !electron.app.commandLine.hasSwitch('disable-gpu-compositing') : undefined;

      return { bounds, nativeHandle, gpuCompositing };
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
    let ps: string;
    if (windowInfo.gpuCompositing) {
      // PW_RENDERFULLCONTENT (2) captures the DWM off-screen DX surface — the only reliable
      // way to capture ANGLE/D3D11 Electron content when GPU compositing is active.
      ps =
        `Add-Type -AssemblyName System.Drawing,System.Windows.Forms; ` +
        `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;` +
        `public class W{[DllImport("user32.dll")]public static extern bool PrintWindow(IntPtr h,IntPtr d,uint f);` +
        `[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);` +
        `public struct RECT{public int L,T,R,B;}}'; ` +
        `$h=[IntPtr]${hwnd}; $r=New-Object W+RECT; [W]::GetWindowRect($h,[ref]$r) | Out-Null; ` +
        `$b=New-Object Drawing.Bitmap ($r.R-$r.L),($r.B-$r.T); ` +
        `$g=[Drawing.Graphics]::FromImage($b); ` +
        `$hdc=$g.GetHdc(); [W]::PrintWindow($h,$hdc,2) | Out-Null; $g.ReleaseHdc($hdc); $g.Dispose(); ` +
        `$b.Save('${outFwd}',[Drawing.Imaging.ImageFormat]::Png)`;
    } else {
      // No-GPU path (CI / VMs without hardware GPU): the caller must launch Electron with
      // --disable-gpu-compositing AND --disable-direct-composition. Together these force
      // Chromium to use the software compositor and present via GDI BitBlt to the window's
      // HDC, putting the rendered content in the per-window DWM redirection bitmap.
      // GetWindowDC(hwnd) reads that bitmap directly (full window incl. title bar).
      // Without --disable-direct-composition, Chromium presents via DComp and GDI captures
      // return blank; PW_RENDERFULLCONTENT can't be used because it deadlocks under WARP.
      const { width, height } = windowInfo.bounds;
      ps =
        `Add-Type -AssemblyName System.Drawing; ` +
        `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;` +
        `public class W{` +
        `[DllImport("user32.dll")]public static extern IntPtr GetWindowDC(IntPtr h);` +
        `[DllImport("user32.dll")]public static extern int ReleaseDC(IntPtr h,IntPtr d);` +
        `[DllImport("gdi32.dll")]public static extern bool BitBlt(IntPtr d,int dx,int dy,int w,int h,IntPtr s,int sx,int sy,uint rop);` +
        `}'; ` +
        `$h=[IntPtr]${hwnd}; ` +
        `$src=[W]::GetWindowDC($h); ` +
        `$b=New-Object Drawing.Bitmap ${width},${height}; ` +
        `$g=[Drawing.Graphics]::FromImage($b); ` +
        `$dst=$g.GetHdc(); ` +
        `[W]::BitBlt($dst,0,0,${width},${height},$src,0,0,0x00CC0020) | Out-Null; ` +
        `$g.ReleaseHdc($dst); $g.Dispose(); ` +
        `[W]::ReleaseDC($h,$src) | Out-Null; ` +
        `$b.Save('${outFwd}',[Drawing.Imaging.ImageFormat]::Png)`;
    }
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { timeout: 30_000 });
    if (r.error) throw r.error;
    if (r.status !== 0) {
      throw new Error(`PowerShell capture failed (exit ${r.status}): ${r.stderr?.toString().trim()}`);
    }
  } else {
    throw new Error(`nativeScreenshot is not supported on ${process.platform}`);
  }

  try {
    return readFileSync(out);
  } finally {
    unlinkSync(out);
  }
}
