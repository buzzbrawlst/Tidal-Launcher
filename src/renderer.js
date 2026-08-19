let CONFIG;
let settings;
let statusData;


const $ = id =>
    document.getElementById(id);


function toast(message) {

    const element =
        $("toast");

    element.textContent =
        message;

    element.classList.add(
        "show"
    );

    setTimeout(
        () =>
            element.classList.remove(
                "show"
            ),
        2800
    );
}


/* INITIALISE */

async function init() {

    const data =
        await window.tidal.getConfig();

    CONFIG = data;

    settings =
        data.settings;


    $("gameName").textContent =
        data.game.displayName;


    $("version").textContent =
        `Version ${data.game.version}`;


    $("path").textContent =
        settings.installDir;


    $("settingsPath").textContent =
        settings.installDir;


    checkStatus();
}


/* GAME STATUS */

async function checkStatus() {

    statusData =
        await window.tidal
            .getGameStatus();


    if (statusData.installed) {

        $("status").textContent =
            "Ready to launch";

        $("launchBtn").disabled =
            false;

    } else {

        $("status").textContent =
            "Not installed";

        $("launchBtn").disabled =
            true;

    }

}


/* FOLDER */

async function chooseFolder() {

    const folder =
        await window.tidal
            .chooseFolder();


    if (!folder)
        return;


    settings.installDir =
        folder;


    $("path").textContent =
        folder;


    $("settingsPath").textContent =
        folder;


    toast(
        "Installation folder updated."
    );


    checkStatus();

}


/* INSTALL */

async function install() {

    try {

        $("installBtn").disabled =
            true;

        $("installBtn2").disabled =
            true;


        $("progressMeta").textContent =
            "Starting download…";


        await window.tidal
            .installGame();


        $("progressBar")
            .style.width =
            "100%";


        $("progressText")
            .textContent =
            "100%";


        $("progressFile")
            .textContent =
            "Complete";


        $("progressMeta")
            .textContent =
            "Installation finished.";


        toast(
            "Installation complete."
        );


        await checkStatus();


    } catch (error) {

        toast(
            error.message ||
            "Installation failed."
        );


        $("progressMeta")
            .textContent =
            error.message ||
            "Installation failed.";


    } finally {

        $("installBtn").disabled =
            false;

        $("installBtn2").disabled =
            false;

    }

}


/* LAUNCH */

async function launch() {

    try {

        await window.tidal
            .launchGame();

        toast(
            "Game launched."
        );

    } catch (error) {

        toast(
            error.message ||
            "Unable to launch."
        );

    }

}


/* NAVIGATION */

document
    .querySelectorAll(".nav")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        ".nav"
                    )
                    .forEach(
                        item =>
                            item.classList
                                .remove(
                                    "active"
                                )
                    );


                document
                    .querySelectorAll(
                        ".page"
                    )
                    .forEach(
                        page =>
                            page.classList
                                .remove(
                                    "active"
                                )
                    );


                button.classList.add(
                    "active"
                );


                $(
                    button.dataset.page
                ).classList.add(
                    "active"
                );

            }
        );

    });


/* BUTTONS */

$("choose").onclick =
    chooseFolder;

$("choose2").onclick =
    chooseFolder;

$("open").onclick =
    () =>
        window.tidal.openFolder(
            settings.installDir
        );

$("installBtn").onclick =
    install;

$("installBtn2").onclick =
    install;

$("launchBtn").onclick =
    launch;


$("min").onclick =
    () =>
        window.tidal.minimize();


$("max").onclick =
    () =>
        window.tidal.maximize();


$("close").onclick =
    () =>
        window.tidal.close();


/* INSTALL PROGRESS */

window.tidal
    .onInstallProgress(
        data => {

            const percent =
                Math.max(
                    0,
                    Math.min(
                        100,
                        data.percent || 0
                    )
                );


            $("progressBar")
                .style.width =
                percent + "%";


            $("progressText")
                .textContent =
                percent.toFixed(1) +
                "%";


            $("progressFile")
                .textContent =
                data.file ||
                "Downloading";


            const received =
                (
                    data.received /
                    1024 /
                    1024
                ).toFixed(1);


            const total =
                data.total
                    ? (
                        data.total /
                        1024 /
                        1024
                    ).toFixed(1)
                    : "?";


            $("progressMeta")
                .textContent =
                `${received} MB / ${total} MB`;

        }
    );


/* CURSOR */

document.addEventListener(
    "mousemove",
    event => {

        const cursor =
            $("cursor");


        cursor.style.left =
            event.clientX + "px";


        cursor.style.top =
            event.clientY + "px";

    }
);


/* START */

init();


/* ==================================================
   INTERACTIVE WEBGL WATER
================================================== */

const canvas =
    $("water");


const gl =
    canvas.getContext(
        "webgl",
        {
            antialias: true,
            alpha: false
        }
    );


if (!gl) {

    console.error(
        "WebGL is unavailable."
    );

}


/* VERTEX */

const vertexSource = `

attribute vec2 position;

void main() {

    gl_Position =
        vec4(
            position,
            0.0,
            1.0
        );

}

`;


/* FRAGMENT */

const fragmentSource = `

precision highp float;

uniform vec2 resolution;
uniform vec2 mouse;
uniform float time;


float hash(vec2 p) {

    return fract(
        sin(
            dot(
                p,
                vec2(
                    127.1,
                    311.7
                )
            )
        )
        *
        43758.5453
    );

}


float noise(vec2 p) {

    vec2 i =
        floor(p);

    vec2 f =
        fract(p);


    f =
        f *
        f *
        (
            3.0 -
            2.0 *
            f
        );


    float a =
        hash(i);


    float b =
        hash(
            i +
            vec2(
                1.0,
                0.0
            )
        );


    float c =
        hash(
            i +
            vec2(
                0.0,
                1.0
            )
        );


    float d =
        hash(
            i +
            vec2(
                1.0,
                1.0
            )
        );


    return mix(
        mix(
            a,
            b,
            f.x
        ),

        mix(
            c,
            d,
            f.x
        ),

        f.y
    );

}


float waterNoise(vec2 p) {

    float n = 0.0;

    n +=
        noise(p)
        *
        0.5;

    n +=
        noise(p * 2.0)
        *
        0.25;

    n +=
        noise(p * 4.0)
        *
        0.125;

    n +=
        noise(p * 8.0)
        *
        0.0625;

    return n;

}


void main() {

    vec2 uv =
        gl_FragCoord.xy /
        resolution.xy;


    vec2 p =
        uv -
        0.5;


    float aspect =
        resolution.x /
        resolution.y;


    p.x *=
        aspect;


    vec2 flow =
        p;


    flow +=
        vec2(
            time * 0.018,
            time * 0.010
        );


    float n1 =
        waterNoise(
            flow * 2.7
        );


    float n2 =
        waterNoise(
            flow * 6.0 -
            time * 0.025
        );


    vec2 m =
        mouse -
        0.5;


    m.x *=
        aspect;


    float dist =
        distance(
            p,
            m
        );


    float waves =
        sin(
            dist * 75.0 -
            time * 5.0
        );


    float falloff =
        exp(
            -dist * 7.0
        );


    float mouseWater =
        waves *
        falloff;


    float surface =
        n1 * 0.10 +
        n2 * 0.035 +
        mouseWater * 0.045;


    float sampleX =
        waterNoise(
            flow * 2.7 +
            vec2(
                0.012,
                0.0
            )
        );


    float sampleY =
        waterNoise(
            flow * 2.7 +
            vec2(
                0.0,
                0.012
            )
        );


    vec3 normal =
        normalize(
            vec3(
                (n1 - sampleX) * 5.0,
                (n1 - sampleY) * 5.0,
                1.0
            )
        );


    vec3 light =
        normalize(
            vec3(
                -0.45,
                -0.6,
                1.0
            )
        );


    float diffuse =
        max(
            dot(
                normal,
                light
            ),
            0.0
        );


    vec3 darkBlue =
        vec3(
            0.005,
            0.20,
            0.42
        );


    vec3 midBlue =
        vec3(
            0.01,
            0.48,
            0.72
        );


    vec3 lightBlue =
        vec3(
            0.16,
            0.78,
            0.94
        );


    float depth =
        smoothstep(
            1.0,
            0.0,
            uv.y
        );


    vec3 color =
        mix(
            midBlue,
            darkBlue,
            depth
        );


    color =
        mix(
            color,
            lightBlue,
            diffuse * 0.35
        );


    float caustic =
        sin(
            n1 * 18.0 +
            time * 0.8
        );


    caustic =
        smoothstep(
            0.65,
            0.95,
            caustic
        );


    color +=
        vec3(
            0.08,
            0.20,
            0.24
        )
        *
        caustic;


    float highlight =
        pow(
            max(
                normal.z,
                0.0
            ),
            9.0
        );


    color +=
        vec3(
            0.20,
            0.45,
            0.55
        )
        *
        highlight
        *
        0.25;


    float glow =
        exp(
            -dist * 5.0
        );


    color +=
        vec3(
            0.08,
            0.18,
            0.25
        )
        *
        glow;


    color +=
        vec3(
            0.03,
            0.12,
            0.18
        )
        *
        mouseWater;


    float vignette =
        smoothstep(
            1.1,
            0.25,
            length(
                uv -
                0.5
            )
        );


    color *=
        0.82 +
        vignette *
        0.18;


    gl_FragColor =
        vec4(
            color,
            1.0
        );

}

`;


/* SHADER */

function createShader(
    type,
    source
) {

    const shader =
        gl.createShader(type);


    gl.shaderSource(
        shader,
        source
    );


    gl.compileShader(
        shader
    );


    if (
        !gl.getShaderParameter(
            shader,
            gl.COMPILE_STATUS
        )
    ) {

        throw new Error(
            gl.getShaderInfoLog(
                shader
            )
        );

    }


    return shader;

}


const vertexShader =
    createShader(
        gl.VERTEX_SHADER,
        vertexSource
    );


const fragmentShader =
    createShader(
        gl.FRAGMENT_SHADER,
        fragmentSource
    );


const program =
    gl.createProgram();


gl.attachShader(
    program,
    vertexShader
);


gl.attachShader(
    program,
    fragmentShader
);


gl.linkProgram(
    program
);


gl.useProgram(
    program
);


/* QUAD */

const buffer =
    gl.createBuffer();


gl.bindBuffer(
    gl.ARRAY_BUFFER,
    buffer
);


gl.bufferData(
    gl.ARRAY_BUFFER,

    new Float32Array([
        -1,-1,
         1,-1,
        -1, 1,

        -1, 1,
         1,-1,
         1, 1
    ]),

    gl.STATIC_DRAW

);


const position =
    gl.getAttribLocation(
        program,
        "position"
    );


gl.enableVertexAttribArray(
    position
);


gl.vertexAttribPointer(
    position,
    2,
    gl.FLOAT,
    false,
    0,
    0
);


/* UNIFORMS */

const resolution =
    gl.getUniformLocation(
        program,
        "resolution"
    );


const mouse =
    gl.getUniformLocation(
        program,
        "mouse"
    );


const time =
    gl.getUniformLocation(
        program,
        "time"
    );


/* MOUSE */

let targetX = 0.5;
let targetY = 0.5;

let mouseX = 0.5;
let mouseY = 0.5;


window.addEventListener(
    "mousemove",
    event => {

        targetX =
            event.clientX /
            window.innerWidth;


        targetY =
            1 -
            event.clientY /
            window.innerHeight;

    }
);


/* TOUCH */

window.addEventListener(
    "touchmove",
    event => {

        const touch =
            event.touches[0];


        if (!touch)
            return;


        targetX =
            touch.clientX /
            window.innerWidth;


        targetY =
            1 -
            touch.clientY /
            window.innerHeight;

    },

    {
        passive: true
    }

);


/* RESIZE */

function resize() {

    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );


    canvas.width =
        window.innerWidth *
        dpr;


    canvas.height =
        window.innerHeight *
        dpr;


    gl.viewport(
        0,
        0,
        canvas.width,
        canvas.height
    );

}


window.addEventListener(
    "resize",
    resize
);


resize();


/* RENDER */

const start =
    performance.now();


function render(now) {

    const elapsed =
        (
            now -
            start
        ) /
        1000;


    mouseX +=
        (
            targetX -
            mouseX
        )
        *
        0.06;


    mouseY +=
        (
            targetY -
            mouseY
        )
        *
        0.06;


    gl.uniform2f(
        resolution,
        canvas.width,
        canvas.height
    );


    gl.uniform2f(
        mouse,
        mouseX,
        mouseY
    );


    gl.uniform1f(
        time,
        elapsed
    );


    gl.drawArrays(
        gl.TRIANGLES,
        0,
        6
    );


    requestAnimationFrame(
        render
    );

}


requestAnimationFrame(
    render
);
