package id.co.b41m.kasir;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "ReceiptPrinter",
    permissions = {
        @Permission(alias = "bluetoothConnect", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class ReceiptPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile BluetoothSocket socket;

    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        if (needsBluetoothPermission()) {
            requestPermissionForAlias("bluetoothConnect", call, "pairedDevicesPermissionResult");
            return;
        }
        resolvePairedDevices(call);
    }

    @PermissionCallback
    private void pairedDevicesPermissionResult(PluginCall call) {
        if (hasBluetoothPermission()) {
            resolvePairedDevices(call);
        } else {
            call.reject("Izin Bluetooth diperlukan untuk melihat printer yang sudah dipasangkan.");
        }
    }

    private void resolvePairedDevices(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            call.reject("Perangkat ini tidak memiliki Bluetooth.");
            return;
        }

        try {
            if (!adapter.isEnabled()) {
                call.reject("Aktifkan Bluetooth Android terlebih dahulu.");
                return;
            }
            JSArray devices = new JSArray();
            Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
            for (BluetoothDevice device : pairedDevices) {
                JSObject item = new JSObject();
                item.put("name", device.getName() == null ? "Printer Bluetooth" : device.getName());
                item.put("address", device.getAddress());
                devices.put(item);
            }
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        } catch (SecurityException exception) {
            call.reject("Izin Bluetooth tidak diberikan.", exception);
        }
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));
            call.resolve();
        } catch (Exception exception) {
            call.reject("Pengaturan Bluetooth tidak dapat dibuka.", exception);
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (needsBluetoothPermission()) {
            requestPermissionForAlias("bluetoothConnect", call, "connectPermissionResult");
            return;
        }
        connectPairedDevice(call);
    }

    @PermissionCallback
    private void connectPermissionResult(PluginCall call) {
        if (hasBluetoothPermission()) {
            connectPairedDevice(call);
        } else {
            call.reject("Izin Bluetooth diperlukan untuk menghubungkan printer.");
        }
    }

    private void connectPairedDevice(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Pilih printer yang sudah dipasangkan.");
            return;
        }

        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            call.reject("Perangkat ini tidak memiliki Bluetooth.");
            return;
        }

        executor.execute(() -> {
            BluetoothSocket newSocket = null;
            try {
                BluetoothDevice device = adapter.getRemoteDevice(address);
                if (!adapter.getBondedDevices().contains(device)) {
                    call.reject("Printer belum dipasangkan. Pasangkan dari pengaturan Bluetooth Android.");
                    return;
                }
                closeSocket();
                newSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                newSocket.connect();
                socket = newSocket;

                JSObject result = new JSObject();
                result.put("name", device.getName() == null ? "Printer Bluetooth" : device.getName());
                result.put("address", device.getAddress());
                call.resolve(result);
            } catch (Exception exception) {
                closeQuietly(newSocket);
                call.reject("Gagal terhubung via Bluetooth SPP. Pastikan MP-58A1 menyala dan sudah dipasangkan.", exception);
            }
        });
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (needsBluetoothPermission()) {
            requestPermissionForAlias("bluetoothConnect", call, "printPermissionResult");
            return;
        }
        printText(call);
    }

    @PermissionCallback
    private void printPermissionResult(PluginCall call) {
        if (hasBluetoothPermission()) {
            printText(call);
        } else {
            call.reject("Izin Bluetooth diperlukan untuk mencetak.");
        }
    }

    private void printText(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.isEmpty()) {
            call.reject("Tidak ada isi struk untuk dicetak.");
            return;
        }
        if (text.length() > 100_000) {
            call.reject("Isi struk terlalu besar.");
            return;
        }

        executor.execute(() -> {
            BluetoothSocket currentSocket = socket;
            if (currentSocket == null || !currentSocket.isConnected()) {
                call.reject("Printer belum terhubung. Hubungkan printer dari Pengaturan.");
                return;
            }
            try {
                OutputStream output = currentSocket.getOutputStream();
                output.write(new byte[] { 0x1B, 0x40 });
                output.write(text.getBytes(StandardCharsets.UTF_8));
                output.write(new byte[] { 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00 });
                output.flush();
                call.resolve();
            } catch (Exception exception) {
                closeSocket();
                call.reject("Gagal mengirim struk ke printer.", exception);
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        executor.execute(() -> {
            closeSocket();
            call.resolve();
        });
    }

    private BluetoothAdapter getBluetoothAdapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    private boolean needsBluetoothPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothPermission();
    }

    private boolean hasBluetoothPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S
            || getPermissionState("bluetoothConnect") == PermissionState.GRANTED;
    }

    private synchronized void closeSocket() {
        BluetoothSocket currentSocket = socket;
        socket = null;
        closeQuietly(currentSocket);
    }

    private void closeQuietly(BluetoothSocket currentSocket) {
        if (currentSocket != null) {
            try {
                currentSocket.close();
            } catch (Exception ignored) {
                // Socket close is best-effort during reconnect and error recovery.
            }
        }
    }
}