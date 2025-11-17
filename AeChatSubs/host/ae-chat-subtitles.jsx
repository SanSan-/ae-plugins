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
            ae_log._file = new File(Folder.temp.fsName + "/ae-chat-subtitles.log");
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

function ae_safeAddProperty(group, matchName) {
    if (!group) return null;
    if (group.canAddProperty && !group.canAddProperty(matchName)) {
        return null;
    }
    try {
        return group.addProperty(matchName);
    } catch (err) {
        return null;
    }
}

function ae_clearProperties(group) {
    if (!group) return;
    for (var i = group.numProperties; i >= 1; --i) {
        var prop = group.property(i);
        if (prop && prop.remove) {
            try {
                prop.remove();
            } catch (err) {
            }
        }
    }
}

function ae_setHoldValue(prop, time, value) {
    var idx;
    if (prop.numKeys === 0) {
        idx = prop.addKey(time);
    } else {
        idx = prop.nearestKeyIndex(time);
        if (Math.abs(prop.keyTime(idx) - time) > 0.0001) {
            idx = prop.addKey(time);
        }
    }
    prop.setValueAtKey(idx, value);
    prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
}

function ae_cloneTextDocument(doc) {
    if (!doc) return new TextDocument("");
    try {
        return eval(doc.toSource());
    } catch (e) {
        var copy = new TextDocument(doc.text || "");
        try {
            copy.font = doc.font;
            copy.fontSize = doc.fontSize;
            copy.applyFill = doc.applyFill;
            copy.fillColor = doc.fillColor;
            copy.applyStroke = doc.applyStroke;
            copy.strokeColor = doc.strokeColor;
            copy.strokeWidth = doc.strokeWidth;
            copy.strokeOverFill = doc.strokeOverFill;
            copy.justification = doc.justification;
        } catch (err) {}
        return copy;
    }
}

function ae_copyTextStyle(dst, template) {
    if (!dst || !template) return dst;
    try { dst.font = template.font; } catch (e) {}
    try { dst.fontSize = template.fontSize; } catch (e) {}
    try { dst.applyFill = template.applyFill; } catch (e) {}
    try { dst.fillColor = template.fillColor; } catch (e) {}
    try { dst.applyStroke = template.applyStroke; } catch (e) {}
    try { dst.strokeColor = template.strokeColor; } catch (e) {}
    try { dst.strokeWidth = template.strokeWidth; } catch (e) {}
    try { dst.strokeOverFill = template.strokeOverFill; } catch (e) {}
    try { dst.justification = template.justification; } catch (e) {}
    return dst;
}

// "hh:mm:ss,mmm" -> seconds
function ae_timecodeToSeconds(tc) {
    var parts = tc.split(":");
    if (parts.length !== 3) return 0;
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var secMs = parts[2].split(",");
    var s = parseInt(secMs[0], 10);
    var ms = parseInt(secMs[1], 10);
    return h * 3600 + m * 60 + s + ms / 1000.0;
}

// Parse SRT -> array { start, end, text }
function ae_parseSrt(content) {
    var lines = content.split(/\r?\n/);
    var res = [];
    var n = lines.length, i = 0;
    while (i < n) {
        while (i < n && lines[i].replace(/\s+/g, "") === "") ++i;
        ++i; // skip sequential number
        if (i >= n) break;
        var timeLine = lines[i++];
        var match = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
        if (!match) continue;
        var textLines = [];
        while (i < n && lines[i].replace(/\s+/g, "") !== "") {
            textLines.push(lines[i++]);
        }
        var text = textLines.join("\n");
        res.push({
            start: ae_timecodeToSeconds(match[1]),
            end: ae_timecodeToSeconds(match[2]),
            text: text
        });
    }
    return res;
}

function ae_importSrt(fontName, fontSize,
                      colR, colG, colB,
                      strokeR, strokeG, strokeB, strokeWidth,
                      posX, posY, offsetSeconds, singleLayer) {
    ae_log("ae_importSrt: start");
    try {
        var comp = ae_getActiveComp();
        if (!comp) {
            alert("Открой композицию и сделай её активной.");
            ae_log("ae_importSrt: no active comp");
            return;
        }
        var srtFile = File.openDialog("Выберите .srt файл", "*.srt");
        if (!srtFile) {
            ae_log("ae_importSrt: selection cancelled");
            return;
        }
        srtFile.encoding = "UTF-8";
        if (!srtFile.open("r")) {
            alert("Не удалось открыть файл.");
            ae_log("ae_importSrt: unable to open file");
            return;
        }
        var content = srtFile.read();
        srtFile.close();
        var entries = ae_parseSrt(content);
        if (!entries || entries.length === 0) {
            alert("Не вышло распарсить .srt файл.");
            ae_log("ae_importSrt: empty parse result");
            return;
        }
        var n = entries.length;
        ae_log("ae_importSrt: entries=" + n);
        app.beginUndoGroup("Импорт SRT субтитров");
        var textLayer = comp.layers.addText("");
        textLayer.name = "Subtitles";
        textLayer.property("Position").setValue([posX, posY]);
        var textProp = textLayer.property("Source Text");
        var baseDoc = textProp.value;
        if (fontName && fontName !== "") baseDoc.font = fontName;
        if (fontSize > 0) baseDoc.fontSize = fontSize;
        baseDoc.applyFill = true;
        baseDoc.fillColor = [colR, colG, colB];
        if (strokeWidth > 0) {
            baseDoc.applyStroke = true;
            baseDoc.strokeColor = [strokeR, strokeG, strokeB];
            baseDoc.strokeWidth = strokeWidth;
            baseDoc.strokeOverFill = false;
        } else {
            baseDoc.applyStroke = false;
        }
        baseDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
        textProp.setValue(baseDoc);
        if (singleLayer) {
            textLayer.enabled = true;
            textLayer.shy = false;
            var blankDoc = ae_copyTextStyle(new TextDocument(""), baseDoc);
            textProp.setValueAtTime(0, blankDoc);
            for (var i = 0; i < n; ++i) {
                var e = entries[i];
                var tStart = e.start + offsetSeconds;
                var tEnd = e.end + offsetSeconds;
                if (tEnd <= 0) continue;
                if (tStart < 0) tStart = 0;
                var doc = ae_copyTextStyle(new TextDocument(e.text || ""), baseDoc);
                textProp.setValueAtTime(tStart, doc);
                textProp.setValueAtTime(tEnd, blankDoc);
            }
        } else {
            textLayer.enabled = false;
            textLayer.shy = true;
            var compDuration = comp.duration;
            for (var i = 0; i < n; ++i) {
                var e = entries[i];
                var tStart = e.start + offsetSeconds;
                var tEnd = e.end + offsetSeconds;
                if (tEnd <= 0) continue;
                if (tStart < 0) tStart = 0;
                if (tStart >= compDuration) continue;
                if (tEnd <= tStart) tEnd = tStart + 0.01;
                if (tEnd > compDuration) tEnd = compDuration;
                var doc = ae_copyTextStyle(new TextDocument(e.text || ""), baseDoc);
                var layer = comp.layers.addText("");
                layer.name = "Subtitle " + (i + 1);
                layer.property("Position").setValue([posX, posY]);
                layer.property("Source Text").setValue(doc);
                layer.inPoint = tStart;
                layer.outPoint = tEnd;
            }
        }
        app.endUndoGroup();
        ae_log("ae_importSrt: done");
    } catch (err) {
        ae_log("ae_importSrt: error " + err.toString());
        alert("Ошибка импорта SRT: " + err.toString());
    }
}

// CSV format: time;user;message
function ae_parseCsvChat(content) {
    var lines = content.split(/\r?\n/);
    var list = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];
        if (!line || line.replace(/\s+/g, "") === "") continue;
        var hasSemicolon = line.indexOf(";") !== -1;
        var delim = hasSemicolon ? ";" : ",";
        var parts = line.split(delim);
        if (parts.length < 3) continue;
        var timeRaw = ae_trim(parts[0]);
        if (hasSemicolon) {
            timeRaw = timeRaw.replace(",", ".");
        }
        var t = parseFloat(timeRaw);
        if (isNaN(t)) continue;
        var user = ae_trim(parts[1]);
        var msgParts = parts.slice(2);
        var msg = ae_trim(msgParts.join(delim));
        list.push({
            time: t,
            user: user,
            text: msg
        });
    }
    list.sort(function (a, b) {
        return a.time - b.time;
    });
    return list;
}

// Shape layer with chat rectangle
function ae_createChatBox(comp, posX, posY, w, h, fillColor) {
    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = "Chat Box";
    var contents = shapeLayer.property("Contents");
    var group = contents.addProperty("ADBE Vector Group");
    group.name = "Box";
    var rect = group.property("Contents").addProperty("ADBE Vector Shape - Rect");
    rect.property("Size").setValue([w, h]);
    rect.property("Position").setValue([0, 0]);
    var fill = group.property("Contents").addProperty("ADBE Vector Graphic - Fill");
    fill.property("Color").setValue(fillColor);
    fill.property("Opacity").setValue(80);
    shapeLayer.property("Position").setValue([posX, posY]);
    return shapeLayer;
}

function ai_applyUserHighlight(textLayer, nameLength, rgb) {
  try {
    if (!textLayer || !rgb) return;
    if (nameLength <= 0) return;
    var textProps = textLayer.property("Text");
    if (!textProps) return;
    var animatorsGroup = textProps.property("ADBE Text Animators");
    if (!animatorsGroup) return;
    var anim = ae_safeAddProperty(animatorsGroup, "ADBE Text Animator");
    if (!anim) return;
    anim.name = "User Highlight";
    var props = anim.property("ADBE Text Animator Properties");
    if (props) {
      var fillProp = ae_safeAddProperty(props, "ADBE Text Animator Fill Color");
      if (fillProp) fillProp.setValue(rgb);
      var scaleProp = ae_safeAddProperty(props, "ADBE Text Animator Scale");
      if (scaleProp) scaleProp.setValue([110, 110, 100]);
    }
    var selectors = anim.property("ADBE Text Selectors");
    if (!selectors) return;
    var selector = ae_safeAddProperty(selectors, "ADBE Text Selector");
    if (!selector) return;
    var advanced = selector.property("ADBE Text Range Advanced");
    if (advanced) advanced.property("ADBE Text Range Units").setValue(1);
    selector.property("ADBE Text Range Start").setValue(0);
    var totalChars = nameLength;
    try {
      totalChars = textLayer.property("Source Text").value.text.length;
    } catch (innerErr) {
      totalChars = nameLength;
    }
    var endValue = Math.max(0, Math.min(nameLength, totalChars));
    selector.property("ADBE Text Range End").setValue(endValue);
  } catch (highlightErr) {
    ae_log("ai_applyUserHighlight: error " + highlightErr.toString());
  }
}

function ae_importChat(fontName, fontSize,
                       txtR, txtG, txtB,
                       userR, userG, userB,
                       fillR, fillG, fillB,
                       posX, posY, w, h,
                       offsetSeconds) {
    ae_log("ae_importChat: start");
    try {
        var comp = ae_getActiveComp();
        if (!comp) {
            alert("Открой композицию и сделай её активной.");
            ae_log("ae_importChat: no active comp");
            return;
        }
        var csvFile = File.openDialog("Выберите .csv файл чата", "*.csv");
        if (!csvFile) {
            ae_log("ae_importChat: selection cancelled");
            return;
        }
        csvFile.encoding = "UTF-8";
        if (!csvFile.open("r")) {
            alert("Не удалось открыть файл.");
            ae_log("ae_importChat: unable to open file");
            return;
        }
        var content = csvFile.read();
        csvFile.close();
        var entries = ae_parseCsvChat(content);
        var n = entries.length;
        if (!entries || n === 0) {
            alert("CSV не содержит корректных строк.");
            ae_log("ae_importChat: empty entries");
            return;
        }
        ae_log("ae_importChat: entries=" + n);
        app.beginUndoGroup("Импорт чата");
        var chatBoxLayer = ae_createChatBox(comp, posX, posY, w, h, [fillR, fillG, fillB]);
        var padding = 20;
        var boxWidth = Math.max(40, w - (padding << 1));
        var boxHeight = Math.max(40, h - (padding << 1));
        var baseLeft = -w / 2 + padding;
        var baseBottom = h / 2 - padding;
        var gap = 6;
        var maxVisible = 6;
        var lineHeight = fontSize * 1.4;
        var animDur = 0.2;
        var layers = [];
        var messageHeights = [];
        for (var i = 0; i < n; ++i) {
            var e = entries[i];
            var t = e.time + offsetSeconds;
            if (t < 0) t = 0;
            var l = comp.layers.addBoxText([boxWidth, boxHeight]);
            l.name = "Chat " + (i + 1);
            l.moveBefore(chatBoxLayer);
            l.parent = chatBoxLayer;
            var txtProp = l.property("Source Text");
            var td = txtProp.value;
            var userText = e.user || "";
            var fullText = userText + ": " + e.text;
            td.text = fullText;
            if (fontName && fontName !== "") td.font = fontName;
            if (fontSize > 0) td.fontSize = fontSize;
            td.applyFill = true;
            td.fillColor = [txtR, txtG, txtB];
            td.applyStroke = false;
            td.justification = ParagraphJustification.LEFT_JUSTIFY;
            txtProp.setValue(td);
            var rect = l.sourceRectAtTime(0, false);
            var anchor = l.property("Transform").property("Anchor Point");
            if (anchor) {
                anchor.setValue([rect.left, rect.top]);
            }
            var msgHeight = Math.max(lineHeight, rect.height);
            messageHeights.push(msgHeight);
            var posProp = l.property("Position");
            var opProp = l.property("Opacity");
            var targetY = baseBottom - msgHeight;
            ae_setHoldValue(opProp, Math.max(0, t - animDur), 0);
            ae_setHoldValue(posProp, t, [baseLeft, targetY]);
            ae_setHoldValue(opProp, t, 100);
            var nameLength = Math.min(fullText.length, (userText.length || 0) + 2);
            ai_applyUserHighlight(l, nameLength, [userR, userG, userB]);
            layers.push(l);
        }
        for (var i = 0; i < n; ++i) {
            var eNew = entries[i];
            var tNew = eNew.time + offsetSeconds;
            if (tNew < 0) tNew = 0;
            var startIndex = Math.max(0, i - maxVisible + 1);
            var yCursor = baseBottom;
            for (var k = i; k >= startIndex; --k) {
                var lVisible = layers[k];
                var posVisible = lVisible.property("Position");
                var opVisible = lVisible.property("Opacity");
                var topY = yCursor - messageHeights[k];
                ae_setHoldValue(posVisible, tNew, [baseLeft, topY]);
                ae_setHoldValue(opVisible, tNew, 100);
                yCursor = topY - gap;
            }
            var hiddenIdx = i - maxVisible;
            if (hiddenIdx >= 0) {
                var lHidden = layers[hiddenIdx];
                var posHidden = lHidden.property("Position");
                var opHidden = lHidden.property("Opacity");
                var lastPos = posHidden.valueAtTime(tNew, true);
                ae_setHoldValue(posHidden, tNew, lastPos);
                ae_setHoldValue(opHidden, tNew, 100);
                ae_setHoldValue(opHidden, tNew + animDur, 0);
            }
        }
        app.endUndoGroup();
        ae_log("ae_importChat: layers=" + layers.length);
    } catch (err) {
        ae_log("ae_importChat: error " + err.toString());
        alert("Ошибка импорта чата: " + err.toString());
    }
}






