require("dotenv").config();
const { By, Key, Builder, until } = require("selenium-webdriver");
const assert = require("assert");
const bcrypt = require("bcrypt");

const LOGIN = process.env.LOGIN;
const CI = process.env.CI;
const USER = process.env.USERBANK;

const loginBCA = (token1, token2) => {
  return new Promise(async (resolve, reject) => {
    let driver = await new Builder().forBrowser("firefox").build();
    await driver.get("https://vpn.klikbca.com/");

    try {
      // Login Part1
      await driver.findElement(By.id("username")).sendKeys(LOGIN);
      await driver
        .findElement(By.id("password_input"))
        .sendKeys(token1, Key.RETURN);

      // klick BCA Bisnis
      await driver.wait(until.elementLocated(By.id("CSCO_tbdiv")));
      await driver.findElement(By.partialLinkText("KlikBCA Bisnis")).click();
      await driver.wait(until.elementLocated(By.id("kbbWeb")));

      // Login Part2
      await driver.findElement(By.name("corp_cd")).sendKeys(CI);
      await driver.findElement(By.name("user_cd")).sendKeys(USER);
      await driver.findElement(By.name("pswd")).sendKeys(token2);
      await driver.findElement(By.name("Image13")).click();

      //  masuk menu mutasi
      let mutasi = "";
      cron.schedule("* * * * *", async () => {
        console.log("running a task every minute");
        mutasi = await formMutasi(driver);
      });
      await logoutBCA(driver);
      await driver.quit();
      return resolve(mutasi);
    } catch (error) {
      await logoutBCA(driver);
      await driver.quit();
      return reject(`${error}`);
    }
  });
};

const formMutasi = (driver) => {
  return new Promise(async (resolve, reject) => {
    try {
      // masuk leftFrame
      await driver.switchTo().frame(driver.findElement(By.name("leftFrame")));
      await driver.wait(until.elementLocated(By.id("divFold0")));
      await driver.sleep(500);

      // klik info rekening dan mutasi
      await driver
        .findElement(By.partialLinkText("Informasi Rekening"))
        .click();
      await driver.findElement(By.partialLinkText("Mutasi Rekening")).click();
      // naik ke frame atas untuk pindah ke frame workspace
      await driver.switchTo().defaultContent();
      await driver.switchTo().frame(driver.findElement(By.name("workspace")));

      await driver.sleep(1000);
      const originalWindow = await driver.getWindowHandle();
      assert((await driver.getAllWindowHandles()).length === 1);

      // klik find
      await driver.findElement(By.name("acct")).click();
      await driver.wait(
        async () => (await driver.getAllWindowHandles()).length === 2
      );

      //Loop through until we find a new window handle
      const windows = await driver.getAllWindowHandles();
      windows.forEach(async (handle) => {
        if (handle !== originalWindow) {
          await driver.switchTo().window(handle);
        }
      });

      //Wait for the new tab to finish loading content
      await driver.wait(until.titleIs("Daftar Rekening"));
      await driver
        .wait(until.elementLocated(By.className("clSubLinks")))
        .click();

      await driver.sleep(1000);
      await driver.switchTo().window(originalWindow);
      await driver.switchTo().defaultContent();
      await driver.switchTo().frame(driver.findElement(By.name("workspace")));

      await driver.findElement(By.name("Show")).click();
      await driver.sleep(500);

      const mutation = await getMutasi(driver);
      return resolve(mutation);
    } catch (error) {
      return reject(error);
    }
  });
};

// sudah work
const getMutasi = (driver) => {
  return new Promise(async (resolve, reject) => {
    try {
      // kembali ke frame atas
      await driver.sleep(1500);
      await driver.switchTo().defaultContent();
      await driver.switchTo().frame(driver.findElement(By.name("workspace")));

      // check if data mutation is not found
      const mutationNotFound = await driver
        .findElement(By.className("clsErrorMsg"))
        .then(
          (value) => value,
          () => false
        );
      if (mutationNotFound) {
        return resolve([]);
      }

      // find noRekening
      let tableInfo = await driver.findElements(By.className("h3"));
      let rekening = (await tableInfo[2].getText())
        .replace(": ", "")
        .replace("-", "");

      // end find noRekening

      let arrayMutasi = [];
      // find element tabel
      let rowsClsEven = await driver.findElements(By.css("tr.clsEven"));
      let rowsClasOdd = await driver.findElements(By.css("tr.clsOdd"));

      const lengthOfTr =
        rowsClsEven.length > rowsClasOdd.length
          ? rowsClsEven.length
          : rowsClasOdd.length;

      for (let i = 0; i < lengthOfTr; i++) {
        let arrayOfTd = [];

        let tdEven =
          (await rowsClsEven[i]?.findElements(By.tagName("td"))) ?? "";
        let tdOdd =
          (await rowsClasOdd[i]?.findElements(By.tagName("td"))) ?? "";

        if (tdEven !== "") {
          let ev = {
            tanggal:
              (await tdEven[0].getText()).trim() +
              `/${new Date().getFullYear()}`,
            keterangan: (await tdEven[1].getText()).trim(),
            cabang: (await tdEven[2].getText()).trim(),
            jumlah: parseInt(
              (await tdEven[3].getText())
                .trim()
                .replace(/[,]/g, "")
                .replace(".00 DB", "")
                .replace(".00 CR", "")
            ),
            saldo: parseInt(
              (await tdEven[4].getText())
                .trim()
                .replace(/[,]/g, "")
                .replace(".00", "")
            ),
            type: (await tdEven[1].getText()).includes("CR") ? "CR" : "DB",
            rekening,
          };
          ev.key = bcrypt.hashSync(JSON.stringify(ev), 10);
          arrayOfTd.push(ev);
        }

        if (tdOdd !== "") {
          let odd = {
            tanggal:
              (await tdOdd[0].getText()).trim() +
              `/${new Date().getFullYear()}`,
            keterangan: (await tdOdd[1].getText()).trim(),
            cabang: (await tdOdd[2].getText()).trim(),
            jumlah: parseInt(
              (await tdOdd[3].getText())
                .trim()
                .replace(/[,]/g, "")
                .replace(".00 DB", "")
                .replace(".00 CR", "")
            ),
            saldo: parseInt(
              (await tdOdd[4].getText())
                .trim()
                .replace(/[,]/g, "")
                .replace(".00", "")
            ),
            type: (await tdOdd[1].getText()).includes("CR") ? "CR" : "DB",
            rekening,
          };
          odd.key = bcrypt.hashSync(JSON.stringify(odd), 10);
          arrayOfTd.push(odd);
        }
        arrayMutasi.push(...arrayOfTd);
      }
      return resolve(arrayMutasi);
    } catch (err) {
      return reject(err);
    }
  });
};

const logoutBCA = (driver, isLogin) => {
  return new Promise(async (resolve, reject) => {
    try {
      await driver
        .navigate()
        .to("javascript:window.CSCO_ITB_logout(window.top)");
      driver.wait(until.alertIsPresent()).then(() => {
        driver.switchTo().alert().accept();
      });
      await driver.sleep(1000);
      await driver.navigate().to("https://www.klikbca.com/");
      console.log("logout success");
      return resolve("Logout Success");
    } catch (err) {
      return reject(err);
    }
  });
};

// 318101
let token1 = "01002422";
let token2 = "12337034";

loginBCA(token1, token2)
  .then((result) => {
    console.log("hasil : ", result);
  })
  .catch((err) => console.log("err", err));
