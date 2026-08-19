const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell
} = require("electron");

const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const crypto = require("crypto");

const CONFIG_PATH = path.join(
  __dirname,
  "..",
  "config",
  "config.json"
);

const CONFIG = JSON.parse(
  fs.readFileSync(CONFIG_PATH, "utf8")
);

let mainWindow;
let settings = {};

function getSettingsPath() {
  return path.join(
    app.getPath("userData"),
    "settings.json"
  );
}

function loadSettings() {
  try {
    settings = JSON.parse(
      fs.readFileSync(getSettingsPath(), "utf8")
    );
  } catch {
    settings = {
      installDir: path.join(
        app.getPath("documents"),
        "Tidal Launcher",
        "Game"
      )
    };
  }
}

function saveSettings() {
  fs.mkdirSync(
    path.dirname(getSettingsPath()),
    { recursive: true }
  );

  fs.writeFileSync(
    getSettingsPath(),
    JSON.stringify(settings, null, 2)
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,

    minWidth: 980,
    minHeight: 650,

    backgroundColor: "#061a2d",

    frame: false,
    resizable: true,

    webPreferences: {
      preload: path.join(
        __dirname,
        "preload.js"
      ),

      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(
    path.join(
      __dirname,
      "index.html"
    )
  );
}

app.whenReady().then(() => {
  loadSettings();

  createWindow();

  app.on("activate", () => {
    if (
      BrowserWindow.getAllWindows().length === 0
    ) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});


/* CONFIG */

ipcMain.handle(
  "get-config",
  () => ({
    launcher: CONFIG.launcher,
    game: CONFIG.game,
    downloads: CONFIG.downloads,
    updates: CONFIG.updates,
    settings
  })
);


/* FOLDER PICKER */

ipcMain.handle(
  "choose-folder",
  async () => {

    const result =
      await dialog.showOpenDialog(
        mainWindow,
        {
          properties: [
            "openDirectory",
            "createDirectory"
          ]
        }
      );

    if (
      result.canceled ||
      !result.filePaths[0]
    ) {
      return null;
    }

    settings.installDir =
      result.filePaths[0];

    saveSettings();

    return settings.installDir;
  }
);


/* SETTINGS */

ipcMain.handle(
  "save-settings",
  (_, next) => {

    settings = {
      ...settings,
      ...next
    };

    saveSettings();

    return settings;
  }
);


/* OPEN INSTALL DIRECTORY */

ipcMain.handle(
  "open-folder",
  (_, folder) => {

    if (
      folder &&
      fs.existsSync(folder)
    ) {
      shell.openPath(folder);
    }
  }
);


/* GAME STATUS */

ipcMain.handle(
  "get-game-status",
  () => {

    const installDir =
      settings.installDir;

    const executable =
      path.join(
        installDir,
        CONFIG.game.executableRelativePath
      );

    return {
      installed:
        fs.existsSync(executable),

      installDir,

      executable
    };
  }
);


/* JSON DOWNLOAD */

function requestJson(url) {

  return new Promise(
    (resolve, reject) => {

      if (!url) {
        reject(
          new Error(
            "No manifest URL configured."
          )
        );

        return;
      }

      const client =
        url.startsWith("https")
          ? https
          : http;

      client.get(
        url,
        response => {

          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            return requestJson(
              response.headers.location
            )
              .then(resolve)
              .catch(reject);
          }

          if (
            response.statusCode !== 200
          ) {
            reject(
              new Error(
                `HTTP ${response.statusCode}`
              )
            );

            return;
          }

          let data = "";

          response.setEncoding(
            "utf8"
          );

          response.on(
            "data",
            chunk => {
              data += chunk;
            }
          );

          response.on(
            "end",
            () => {

              try {

                resolve(
                  JSON.parse(data)
                );

              } catch {

                reject(
                  new Error(
                    "Manifest is not valid JSON."
                  )
                );

              }

            }
          );

        }
      ).on(
        "error",
        reject
      );

    }
  );
}


/* FILE DOWNLOADER */

function downloadFile(
  url,
  destination,
  expectedSha256,
  onProgress
) {

  return new Promise(
    (resolve, reject) => {

      fs.mkdirSync(
        path.dirname(destination),
        {
          recursive: true
        }
      );

      const temp =
        destination + ".part";

      const client =
        url.startsWith("https")
          ? https
          : http;

      function request(target) {

        client.get(
          target,
          response => {

            if (
              response.statusCode >= 300 &&
              response.statusCode < 400 &&
              response.headers.location
            ) {

              return request(
                response.headers.location
              );

            }

            if (
              response.statusCode !== 200
            ) {

              reject(
                new Error(
                  `Download failed: HTTP ${response.statusCode}`
                )
              );

              return;
            }

            const total =
              Number(
                response.headers[
                  "content-length"
                ] || 0
              );

            let received = 0;

            const output =
              fs.createWriteStream(
                temp
              );

            const hash =
              crypto.createHash(
                "sha256"
              );

            response.on(
              "data",
              chunk => {

                received +=
                  chunk.length;

                hash.update(chunk);

                output.write(chunk);

                if (onProgress) {
                  onProgress({
                    received,
                    total
                  });
                }

              }
            );

            response.on(
              "end",
              () => {

                output.end(
                  () => {

                    const actual =
                      hash.digest(
                        "hex"
                      );

                    if (
                      expectedSha256 &&
                      actual.toLowerCase() !==
                        expectedSha256.toLowerCase()
                    ) {

                      try {
                        fs.unlinkSync(
                          temp
                        );
                      } catch {}

                      reject(
                        new Error(
                          "Checksum verification failed."
                        )
                      );

                      return;
                    }

                    fs.renameSync(
                      temp,
                      destination
                    );

                    resolve();

                  }
                );

              }
            );

            response.on(
              "error",
              error => {

                output.destroy();

                reject(error);

              }
            );

          }
        ).on(
          "error",
          reject
        );
      }

      request(url);

    }
  );
}


/* INSTALL */

ipcMain.handle(
  "install-game",
  async event => {

    if (
      !CONFIG.downloads.manifestUrl
    ) {

      throw new Error(
        "No manifestUrl is configured in config/config.json."
      );

    }

    const manifest =
      await requestJson(
        CONFIG.downloads.manifestUrl
      );

    if (
      !Array.isArray(
        manifest.files
      )
    ) {

      throw new Error(
        "Manifest must contain a files array."
      );

    }

    const base =
      settings.installDir;

    fs.mkdirSync(
      base,
      {
        recursive: true
      }
    );

    const totalBytes =
      manifest.files.reduce(
        (sum, file) =>
          sum +
          Number(file.size || 0),
        0
      );

    let completedBytes = 0;

    for (
      const file of manifest.files
    ) {

      if (
        !file.path ||
        !file.url
      ) {

        throw new Error(
          "Every manifest file needs path and url."
        );

      }

      const destination =
        path.join(
          base,
          file.path
        );

      const url =
        file.url.startsWith("http")
          ? file.url
          : CONFIG.downloads.gameBaseUrl.replace(
              /\/$/,
              ""
            ) +
            "/" +
            file.url.replace(
              /^\//,
              ""
            );

      const existing =
        fs.existsSync(
          destination
        )
          ? fs.statSync(
              destination
            ).size
          : 0;

      if (
        file.size &&
        existing === Number(file.size)
      ) {

        completedBytes +=
          Number(file.size);

        event.sender.send(
          "install-progress",
          {
            file: file.path,
            received: completedBytes,
            total: totalBytes,
            percent:
              totalBytes
                ? completedBytes /
                    totalBytes *
                    100
                : 0
          }
        );

        continue;
      }

      await downloadFile(
        url,
        destination,
        file.sha256,
        progress => {

          const received =
            completedBytes +
            progress.received;

          event.sender.send(
            "install-progress",
            {
              file: file.path,
              received,
              total: totalBytes,
              percent:
                totalBytes
                  ? received /
                      totalBytes *
                      100
                  : 0
            }
          );

        }
      );

      completedBytes +=
        Number(file.size || 0);
    }

    return {
      ok: true
    };
  }
);


/* LAUNCH */

ipcMain.handle(
  "launch-game",
  async () => {

    const executable =
      path.join(
        settings.installDir,
        CONFIG.game.executableRelativePath
      );

    if (
      !fs.existsSync(executable)
    ) {

      throw new Error(
        "Game executable was not found."
      );

    }

    const {
      spawn
    } = require(
      "child_process"
    );

    const args =
      CONFIG.game.launchArguments
        ? CONFIG.game.launchArguments
            .split(/\s+/)
            .filter(Boolean)
        : [];

    const child =
      spawn(
        executable,
        args,
        {
          cwd:
            path.dirname(
              executable
            ),

          detached: true,

          stdio: "ignore"
        }
      );

    child.unref();

    return true;
  }
);


/* WINDOW */

ipcMain.handle(
  "window-minimize",
  () => mainWindow.minimize()
);

ipcMain.handle(
  "window-maximize",
  () => {

    if (
      mainWindow.isMaximized()
    ) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }

  }
);

ipcMain.handle(
  "window-close",
  () => mainWindow.close()
);
