from flask import Flask, render_template, request, jsonify
from pymodbus.client import ModbusSerialClient
import os
import sys
import json
import threading
import random

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HISTORY_FILE = os.path.join(BASE_DIR, 'history.json')


PORT = "/dev/ttyUSB0"
SLAVE_ID = 31
BAUDRATE = 9600

modbus_lock = threading.Lock()

# Инициализация Modbus клиента
client = ModbusSerialClient(
    port=PORT,
    baudrate=BAUDRATE,
    parity="N",
    stopbits=2,
    bytesize=8,
    timeout=1,
)

# Симулированные данные для разработки/тестирования без подключенного USB-RS485
sim_relays = [False, False]
sim_reed_switch = True

def is_hardware_available():
    return os.path.exists(PORT)

def ensure_connected():
    if not is_hardware_available():
        return False
    if not client.connected:
        try:
            return client.connect()
        except Exception:
            return False
    return True

# Попытка первичного подключения
if is_hardware_available():
    ensure_connected()

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/settings')
def second_page():
    return render_template(
        'setting.html',
        slave_id=SLAVE_ID,
        port=PORT,
        baudrate=BAUDRATE
    )

@app.route('/api/relay', methods=['POST'])
def handle_relay():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Пустой запрос"}), 400

    channel = int(data.get('channel', 0)) # 0 - Канал 1, 1 - Канал 2
    state = bool(data.get('state'))

    if channel not in [0, 1]:
        return jsonify({"status": "error", "message": "Неверный канал (0 или 1)"}), 400

    if is_hardware_available() and ensure_connected():
        try:
            with modbus_lock:
                client.write_coil(channel, state, slave=SLAVE_ID)
            return jsonify({"status": "ok", "channel": channel, "state": state}), 200
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
    else:
        # Режим симуляции (если модуль физически не подключен к ПК)
        sim_relays[channel] = state
        return jsonify({"status": "ok", "channel": channel, "state": state, "simulated": True}), 200

@app.route('/api/state', methods=['GET'])
def get_state():
    if is_hardware_available() and ensure_connected():
        try:
            with modbus_lock:
                # Читаем состояние первых двух coils (реле 1 и 2)
                res_coils = client.read_coils(0, 2, slave=SLAVE_ID)
                if res_coils.isError():
                    return jsonify({
                        "status": "error",
                        "connected": False,
                        "message": "Ошибка чтения Modbus (coils)",
                        "relays": [False, False],
                        "power": [0.0, 0.0]
                    }), 200

                # Читаем активную мощность (Input Registers 64 и 65, масштаб x0.1 Вт)
                res_power = client.read_input_registers(64, 2, slave=SLAVE_ID)
                if res_power.isError():
                    power_ch1 = 0.0
                    power_ch2 = 0.0
                else:
                    power_ch1 = round(res_power.registers[0] * 0.1, 1)
                    power_ch2 = round(res_power.registers[1] * 0.1, 1)

                # Читаем дискретные входы (геркон на входе 1 - адрес 0)
                res_inputs = client.read_discrete_inputs(0, 2, slave=SLAVE_ID)
                if res_inputs.isError():
                    reed_state = False
                else:
                    # 1 - замкнут (замок закрыт), 0 - разомкнут (замок открыт)
                    reed_state = bool(res_inputs.bits[0])

            return jsonify({
                "status": "ok",
                "connected": True,
                "relays": [bool(res_coils.bits[0]), bool(res_coils.bits[1])],
                "power": [power_ch1, power_ch2],
                "reed_switch": reed_state,
                "door_closed": reed_state
            }), 200
        except Exception as e:
            return jsonify({
                "status": "error",
                "connected": False,
                "message": str(e),
                "relays": [False, False],
                "power": [0.0, 0.0],
                "reed_switch": False,
                "door_closed": False
            }), 200
    else:
        # Устройство физически не подключено (/dev/ttyUSB0 не найден)
        return jsonify({
            "status": "error",
            "connected": False,
            "message": "Модуль не подключен (/dev/ttyUSB0 отсутствует)",
            "relays": [sim_relays[0], sim_relays[1]],
            "power": [0.0, 0.0],
            "reed_switch": sim_reed_switch,
            "door_closed": sim_reed_switch
        }), 200

@app.route('/api/sim/reed', methods=['POST'])
def toggle_sim_reed():
    global sim_reed_switch
    data = request.get_json(silent=True) or {}
    if 'state' in data:
        sim_reed_switch = bool(data['state'])
    else:
        sim_reed_switch = not sim_reed_switch
    return jsonify({
        "status": "ok",
        "reed_switch": sim_reed_switch,
        "door_closed": sim_reed_switch
    }), 200

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:
        print(f"Ошибка чтения history.json: {e}", file=sys.stderr)
        return []

def save_history(history_data):
    try:
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history_data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Ошибка записи history.json: {e}", file=sys.stderr)
        return False

@app.route('/api/history', methods=['GET', 'POST'])
def handle_history():
    if request.method == 'POST':
        entry = request.get_json()
        if not entry or not isinstance(entry, dict):
            return jsonify({"status": "error", "message": "Некорректные данные"}), 400

        history = load_history()
        # Новые записи добавляем в начало
        history.insert(0, entry)
        # Ограничим до 100 последних записей
        history = history[:100]

        if save_history(history):
            return jsonify({"status": "ok", "history": history}), 200
        else:
            return jsonify({"status": "error", "message": "Не удалось записать в history.json"}), 500
    else:
        # GET
        return jsonify({"status": "ok", "history": load_history()}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)