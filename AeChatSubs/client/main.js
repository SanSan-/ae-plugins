(function () {
    'use strict';

    var csInterface = new CSInterface();

    function esc(str) {
        return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function getNumber(id, def) {
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : v;
    }

    function getColor(id, fallbackHex) {
        var hex = fallbackHex || '#ffffff';
        var el = document.getElementById(id);
        if (el && typeof el.value === 'string' && el.value.trim() !== '') {
            hex = el.value.trim();
        }
        if (!/^#([0-9a-f]{6})$/i.test(hex)) {
            hex = fallbackHex || '#ffffff';
        }
        return [
            parseInt(hex.substr(1, 2), 16) / 255,
            parseInt(hex.substr(3, 2), 16) / 255,
            parseInt(hex.substr(5, 2), 16) / 255
        ];
    }

    function initDefaults() {
        var defaults = {
            'sub-color': '#ffffff',
            'sub-stroke-color': '#000000',
            'chat-color': '#ffffff',
            'chat-user-color': '#ffd966',
            'chat-fill': '#1a1a1a'
        };
        Object.keys(defaults).forEach(function (id) {
            var el = document.getElementById(id);
            if (el && (!el.value || el.value.trim() === '')) {
                el.value = defaults[id];
            }
        });
    }

    var modeSelect = document.getElementById('mode');
    var subBlock = document.getElementById('subtitles-settings');
    var chatBlock = document.getElementById('chat-settings');

    function updateMode() {
        var m = modeSelect.value;
        subBlock.style.display = (m === 'subtitles') ? 'block' : 'none';
        chatBlock.style.display = (m === 'chat') ? 'block' : 'none';
    }

    modeSelect.addEventListener('change', updateMode);
    updateMode();
    initDefaults();

    document.getElementById('btn-import-srt').addEventListener('click', function () {
        var font = document.getElementById('sub-font').value;
        var size = getNumber('sub-size', 40);
        var textColor = getColor('sub-color', '#ffffff');
        var strokeColor = getColor('sub-stroke-color', '#000000');
        var strokeWidth = getNumber('sub-stroke-width', 3);
        var singleLayer = document.getElementById('sub-single-layer').checked ? 1 : 0;
        var posX = getNumber('sub-posx', 960);
        var posY = getNumber('sub-posy', 1000);
        var offset = getNumber('sub-offset', 0);

        var cmd = 'ae_importSrt("' + esc(font) + '",' + size + ',' +
            textColor[0] + ',' + textColor[1] + ',' + textColor[2] + ',' +
            strokeColor[0] + ',' + strokeColor[1] + ',' + strokeColor[2] + ',' + strokeWidth + ',' +
            posX + ',' + posY + ',' + offset + ',' + singleLayer + ')';

        csInterface.evalScript(cmd);
    });

    document.getElementById('btn-import-chat').addEventListener('click', function () {
        var font = document.getElementById('chat-font').value;
        var size = getNumber('chat-size', 25);
        var txtColor = getColor('chat-color', '#ffffff');
        var userColor = getColor('chat-user-color', '#ffd966');
        var fillColor = getColor('chat-fill', '#1a1a1a');
        var posX = getNumber('chat-posx', 1680);
        var posY = getNumber('chat-posy', 700);
        var w = getNumber('chat-width', 480);
        var h = getNumber('chat-height', 760);
        var offset = getNumber('chat-offset', 0);

        var cmd = 'ae_importChat("' + esc(font) + '",' + size + ',' +
            txtColor[0] + ',' + txtColor[1] + ',' + txtColor[2] + ',' +
            userColor[0] + ',' + userColor[1] + ',' + userColor[2] + ',' +
            fillColor[0] + ',' + fillColor[1] + ',' + fillColor[2] + ',' +
            posX + ',' + posY + ',' + w + ',' + h + ',' + offset + ')';

        csInterface.evalScript(cmd);
    });

})();
