const puppeteer = require("puppeteer");
const scrapeIt = require("scrape-it");
const fs = require("fs");
var info = JSON.parse(fs.readFileSync("info.json"));

async function order_manga(ime, cena_mange, url) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: "networkidle2",
  });
  can_be_bought = await page.evaluate(() => {
    return (
      document.querySelector(".add-to-basket").innerText == "Add to basket"
    );
  });
  if (can_be_bought == false) {
    browser.close();
    return "Can only be Pre-ordered or is not available";
  }

  await page.click(".add-to-basket");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log("Added to basket");
  await page.click(".continue-to-basket");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log("Continued to basket");
  await page.click(".checkout-btn");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log("Checking out");
  await page.evaluate((info) => {
    document
      .querySelector(".signin-iframe")
      .contentWindow.document.getElementById("ap_email").value = info["email"];
    document
      .querySelector(".signin-iframe")
      .contentWindow.document.getElementById("ap_password").value =
      info["password"];
    document
      .querySelector(".signin-iframe")
      .contentWindow.document.getElementById("signInSubmit")
      .click();
  }, info);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log("Logged in");
  let checkout_info = await page.evaluate((info) => {
    document.getElementById("cvv").value = info["cvv"];
    var ime_mange = document.querySelector(
      "body > div.page-slide > div.content-wrap > div.sidebar.right > div > div.wrapper > dl.item-row > dt"
    ).innerText;
    var kolicina = document.querySelector(
      "body > div.page-slide > div.content-wrap > div.sidebar.right > div > div.heading > span.item-count"
    ).innerText;
    var cena = document.querySelector(
      "body > div.page-slide > div.content-wrap > div.sidebar.right > div > div.wrapper > dl:nth-child(5) > dd"
    ).innerText;
    return { ime_mange, kolicina, cena };
  }, info);
  if (checkout_info["cena"].split(" ")[0] != cena_mange) {
    browser.close();
    return "Price on website is different from scraped one";
  }

  if (ime != checkout_info["ime_mange"].split("\n")[0]) {
    browser.close();
    return "Manga in basket doesn't match";
  }

  //klikni dugme da kupi
  //page.click('body > div.page-slide > div.content-wrap > div.main-content.checkout-page.payment-step > div > form > div.clearfix > button');

  browser.close();
  return "Order successful";
}

function Scrape() {
  scrapeIt(
    "https://www.bookdepository.com/search/?searchTerm=chainsaw+man&searchLang=123&ageRangesTotal=0&category=2633&&selectCurrency=EUR",
    {
      volumes: {
        listItem: ".book-item",
        data: {
          name: ".item-info h3 a",
          price: ".item-info .price-wrap",
          availability: ".item-actions .btn-wrap a",
          link: {
            selector: ".item-info .title a",
            attr: "href",
          },
        },
      },
    }
  ).then(({ data, response }) => {
    console.log(
      `${new Date().toLocaleString()} Status Code: ${response.statusCode}`
    );
    let to_order = JSON.parse(fs.readFileSync("to_order.json"));
    data["volumes"].forEach((el) => {
      el.price = el.price.split(" ")[0];
      let order_index = to_order["volumes"].findIndex((s) => s.name == el.name);
      if (
        order_index != -1 &&
        el.availability == "Add to basket" &&
        parseFloat(to_order["volumes"][order_index].price) >=
          parseFloat(el.price) &&
        to_order["volumes"][order_index].bought == false
      ) {
        to_order["volumes"][order_index].bought = true;
        order_manga(
          `${el.name} (Paperback, English)`,
          el.price,
          `https://www.bookdepository.com${el.link}`
        ).then((result) => console.log(result));
      }
    });
    fs.writeFileSync("to_order.json", JSON.stringify(to_order));
  });
}

console.log("Bot started");
setInterval(function () {
  Scrape();
}, 60 * 1000);
