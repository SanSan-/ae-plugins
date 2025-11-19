// Utility helpers for AE
function ae_getActiveComp() {
    if (!app.project) return null;
    var item = app.project.activeItem;
    if (!item || !(item instanceof CompItem)) return null;
    return item;
}

function ae_log(msg) {
    try {
        if (!ae_log._file) {
            ae_log._file = new File(Folder.temp.fsName + "/ae-slides.log");
        }
        var f = ae_log._file;
        if (f.open("a")) {
            var stamp = (new Date()).toUTCString();
            f.writeln("[" + stamp + "] " + msg);
            f.close();
        }
    } catch (err) {
        // keep logger errors silent to avoid breaking the main flow
    }
}

function ae_trim(str) {
    if (!str) return "";
    return str.replace(/^\s+|\s+$/g, "");
}

function ae_precomposeLayers(comp, layers, name) {
    if (!comp || !layers || layers.length === 0) return null;
    var ids = [];
    for (var i = 0; i < layers.length; ++i) {
        var l = layers[i];
        if (l && typeof l.index === "number") {
            ids.push(l.index);
        }
    }
    if (ids.length === 0) return null;
    ids.sort(function (a, b) { return a - b; });
    try {
        return comp.layers.precompose(ids, name, true);
    } catch (err) {
        ae_log("ae_precomposeLayers: ошибка " + err.toString());
        return null;
    }
}

function ae_parseSlidesCsv(content) {
    var lines = content.split(/\r?\n/);
    var list = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];
        if (!line || line.replace(/\s+/g, "") === "") continue;
        var hasSemicolon = line.indexOf(";") !== -1;
        var delim = hasSemicolon ? ";" : ",";
        var parts = line.split(delim);
        if (parts.length < 2) continue;
        var rawTime = ae_trim(parts[0]).replace(",", ".");
        var t = parseFloat(rawTime);
        if (isNaN(t)) continue;
        var name = ae_trim(parts[1]);
        if (!name) continue;
        list.push({
            time: t,
            name: name
        });
    }
    list.sort(function (a, b) {
        return a.time - b.time;
    });
    return list;
}

function ae_indexProjectItems() {
    var map = {};
    if (!app.project) return map;
    for (var i = 1; i <= app.project.numItems; ++i) {
        var item = app.project.item(i);
        if (!item || (item instanceof FolderItem)) continue;
        if (typeof item.name === "string" && !map[item.name]) {
            map[item.name] = item;
        }
    }
    return map;
}

function ae_importSlides(offsetSeconds) {
    ae_log("ae_importSlides: start");
    try {
        offsetSeconds = parseFloat(offsetSeconds);
        if (isNaN(offsetSeconds)) offsetSeconds = 0;
        var comp = ae_getActiveComp();
        if (!comp) {
            alert("Нет активной композиции.");
            ae_log("ae_importSlides: no active comp");
            return;
        }
        var csvFile = File.openDialog("Выберите .csv со слайдами", "*.csv");
        if (!csvFile) {
            ae_log("ae_importSlides: selection cancelled");
            return;
        }
        csvFile.encoding = "UTF-8";
        if (!csvFile.open("r")) {
            alert("Не удалось открыть файл.");
            ae_log("ae_importSlides: unable to open file");
            return;
        }
        var content = csvFile.read();
        csvFile.close();
        var entries = ae_parseSlidesCsv(content);
        if (!entries || entries.length === 0) {
            alert("CSV пуст или не распознан.");
            ae_log("ae_importSlides: empty entries");
            return;
        }
        var items = ae_indexProjectItems();
        var placed = [];
        app.beginUndoGroup("Импорт слайдов");
        for (var i = 0; i < entries.length; ++i) {
            var e = entries[i];
            var t = e.time + offsetSeconds;
            if (t < 0) t = 0;
            var src = items[e.name];
            if (!src) {
                ae_log("ae_importSlides: не найден источник \"" + e.name + "\"");
                continue;
            }
            var layer = comp.layers.add(src);
            layer.moveToBeginning(); // новые слои наверх, чтобы ранние остались снизу
            placed.push({
                layer: layer,
                start: t
            });
        }
        var nPlaced = placed.length;
        if (nPlaced === 0) {
            app.endUndoGroup();
            alert("Не удалось добавить слои: проверьте имена слайдов в проекте.");
            ae_log("ae_importSlides: no layers created");
            return;
        }
        for (var k = 0; k < nPlaced; ++k) {
            var cur = placed[k];
            var nextStart = comp.duration;
            if (k + 1 < nPlaced) {
                nextStart = placed[k + 1].start;
            }
            if (nextStart <= cur.start) nextStart = cur.start + 0.01;
            if (nextStart > comp.duration) nextStart = comp.duration;
            cur.layer.inPoint = cur.start;
            cur.layer.outPoint = nextStart;
        }
        var allLayers = [];
        for (var m = 0; m < nPlaced; ++m) {
            allLayers.push(placed[m].layer);
        }
        ae_precomposeLayers(comp, allLayers, "Slides Precomp");
        app.endUndoGroup();
        ae_log("ae_importSlides: done, layers=" + nPlaced);
    } catch (err) {
        ae_log("ae_importSlides: ошибка " + err.toString());
        alert("Ошибка импорта слайдов: " + err.toString());
    }
}
