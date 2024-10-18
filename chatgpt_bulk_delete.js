// ==UserScript==
// @name         ChatGPT Bulk Delete Tool
// @namespace    https://sannjay.github.io/
// @version      1.0.2
// @description  Easily manage and bulk delete ChatGPT conversations directly from the interface using the API. Safe and smooth operation with better handling than most extensions.
// @author       Sannjay
// @match        https://chat.openai.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/cu-sanjay/Bulk-Delete-for-ChatGPT/main/chatgpt_bulk_delete.js
// @updateURL    https://raw.githubusercontent.com/cu-sanjay/Bulk-Delete-for-ChatGPT/main/chatgpt_bulk_delete.js
// ==/UserScript==

(function () {
  "use strict";

  const globalData = {};

  // Initialization of global state data
  const initGlobalData = () => {
    globalData.token = "";
    globalData.tokenError = false;
    globalData.selectedChats = {};
    globalData.extensionOutdated = false;
  };

  // Handle the checkbox click for selecting or deselecting chats
  const checkBoxHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();

    // Delay for checkbox handling to prevent any UI race conditions
    setTimeout(() => {
      e.target.checked = !e.target.checked;
    }, 1);

    const liElement = e.target.closest("li");
    const keys = Object.keys(liElement);
    let chatObj = {};

    for (const key of keys) {
      if (keys[key].includes("reactProps")) {
        const propsKey = keys[key];
        if (liElement[propsKey].children && liElement[propsKey].children.props) {
          if (!liElement[propsKey].children.props.conversation) {
            // Handle outdated front-end UI by disabling checkbox
            e.target.checked = false;
            e.target.disabled = true;
            e.target.style.opacity = 0.5;
            globalData.extensionOutdated = true;
            return;
          }

          const chatData = liElement[propsKey].children.props.conversation;
          const textContent = chatData.title;
          const chatId = chatData.id;

          chatObj = {
            id: chatId,
            text: textContent,
            projectionId: liElement.dataset.projectionId,
          };
        }
      }
    }

    // Add or remove chat based on checkbox state
    if (chatObj.id) {
      if (e.target.checked) {
        globalData.selectedChats[chatObj.id] = chatObj;
      } else {
        delete globalData.selectedChats[chatObj.id];
      }
    }
  };

  // Adds checkboxes to chat items if needed
  const addCheckboxesToChatsIfNeeded = () => {
    const chats = document.querySelectorAll(
      'nav li:not([data-projection-id=""]):not(.customCheckbox)'
    );
    chats.forEach((chat) => {
      if (chat.querySelector(".customCheckbox")) {
        return;
      }
      const inputElement = document.createElement("input");
      inputElement.setAttribute("type", "checkbox");
      inputElement.setAttribute("class", "customCheckbox");
      inputElement.onclick = debounce(checkBoxHandler, 200); // Debouncing to avoid rapid click issues
      chat.querySelector("a").insertAdjacentElement("afterbegin", inputElement);
    });
  };

  const closeDialog = () => {
    const dialogElement = document.getElementById("customDeleteDialogModal");
    if (dialogElement) {
      dialogElement.remove();
      const inputs = document.querySelectorAll(".customCheckbox");
      inputs.forEach((input) => {
        input.disabled = false;
      });
    }
  };

  const getSecChUaString = () => {
    if (navigator.userAgentData && navigator.userAgentData.brands) {
      return navigator.userAgentData.brands
        .map((brand) => `"${brand.brand}";v="${brand.version}"`)
        .join(", ");
    }
    return '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"'; // Default value
  };

  const getPlatform = () => {
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      return navigator.userAgentData.platform;
    }
    return "Linux";
  };

  const getToken = () => {
    return fetch("https://chat.openai.com/api/auth/session", {
      headers: {
        accept: "*/*",
        "accept-language": "en-US",
        "cache-control": "no-cache",
        "content-type": "application/json",
        pragma: "no-cache",
        "sec-ch-ua": getSecChUaString(),
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": getPlatform(),
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
      referrer: "https://chat.openai.com/",
      referrerPolicy: "same-origin",
    })
      .then((res) => res.json())
      .then((res) => {
        globalData.token = res.accessToken;
        return res.accessToken;
      })
      .catch((err) => {
        console.log(err);
        globalData.tokenError = true;
      });
  };

  const doDelete = (chatId) => {
    return fetch(`https://chat.openai.com/backend-api/conversation/${chatId}`, {
      headers: {
        accept: "*/*",
        "accept-language": "en-US",
        authorization: `Bearer ${globalData.token}`,
        "cache-control": "no-cache",
        "content-type": "application/json",
        pragma: "no-cache",
        "sec-ch-ua": getSecChUaString(),
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": getPlatform(),
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
      referrer: `https://chat.openai.com/c/${chatId}`,
      referrerPolicy: "same-origin",
      body: '{"is_visible":false}',
      method: "PATCH",
      mode: "cors",
      credentials: "include",
    }).then((res) => res.json());
  };

  const addBulkDeleteButton = () => {
    const html = `
      <div id="customOpenBulkDeleteDialog" class="mb-1 flex flex-row gap-2">
        <a class="btn bulk-delete-btn">Bulk Delete Chats</a>
      </div>
    `;
    document.querySelector("nav").querySelector("div").insertAdjacentHTML("afterend", html);
    document.getElementById("customOpenBulkDeleteDialog").onclick = showDeleteDialog;
  };

  const deleteSelectedChats = () => {
    const selectedChatIds = Object.keys(globalData.selectedChats);
    const doDeleteLocal = (chatId) => {
      const dialogChatElement = document.getElementById(`custom${chatId}`);
      return doDelete(chatId)
        .then((res) => {
          if (res.success) {
            dialogChatElement.innerHTML = `<s>${dialogChatElement.innerHTML}</s>`;
            dialogChatElement.style.color = "green";
          } else {
            dialogChatElement.innerHTML = `<span style="color:red;">Error deleting ${dialogChatElement.innerHTML}</span>`;
          }
          delete globalData.selectedChats[chatId];
        })
        .catch((err) => {
          console.log("Delete failure", err);
          dialogChatElement.innerHTML = `<span style="color:red;">Error deleting ${dialogChatElement.innerHTML}</span>`;
        });
    };

    const deletePromises = selectedChatIds.map((chatId, index) => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(doDeleteLocal(chatId)), 100 * index);
      });
    });

    return Promise.all(deletePromises).then(() => {
      document.querySelector(".customCancelButton").innerHTML = "Close";
      document.querySelector(".customDeleteButton").disabled = true;
      const refreshButton = document.createElement("button");
      refreshButton.innerHTML = "Refresh Page";
      refreshButton.onclick = () => window.location.reload();
      document.querySelector("#customBulkDeleteButtons").appendChild(refreshButton);
    });
  };

  const showDeleteDialog = () => {
    const inputs = document.querySelectorAll(".customCheckbox");
    inputs.forEach((input) => (input.disabled = true));

    const dialogElement = document.createElement("div");
    dialogElement.setAttribute("id", "customDeleteDialog");

    const message = Object.keys(globalData.selectedChats).length
      ? "Are you sure you want to delete the selected chats?"
      : "No chats selected.";

    dialogElement.innerHTML = `
      <div class="modal">
        <div class="modal-content">
          <h2>Delete chat?</h2>
          <p>${message}</p>
          <div id="customErrorDiv"></div>
          <br>
          <div id="selectedChats">${Object.values(globalData.selectedChats).map(chat => `<strong>${chat.text}</strong><br>`).join('')}</div>
          <div id="customBulkDeleteButtons">
            <button class="btn customDeleteButton">Delete</button>
            <button class="btn customCancelButton">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialogElement);
    document.querySelector(".customCancelButton").onclick = closeDialog;
    document.querySelector(".customDeleteButton").onclick = deleteSelectedChats;
  };

  const debounce = (func, wait) => {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  };

  const appObserver = new MutationObserver(() => {
    addCheckboxesToChatsIfNeeded();
    if (!document.getElementById("customOpenBulkDeleteDialog")) {
      addBulkDeleteButton();
    }
  });

  window.addEventListener("load", () => {
    getToken().then(() => {
      if (!globalData.tokenError) {
        initGlobalData();
        appObserver.observe(document, { childList: true, subtree: true });
      }
    });
  });
})();
