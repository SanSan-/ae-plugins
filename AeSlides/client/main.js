(function () {
    'use strict';

    var csInterface = new CSInterface();

    function getNumber(id, def) {
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : v;
    }

    document.getElementById('btn-import-slides').addEventListener('click', function () {
        var offset = getNumber('slides-offset', 0);
        var cmd = 'ae_importSlides(' + offset + ')';
        csInterface.evalScript(cmd);
    });
})();
