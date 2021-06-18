import Web3 from "web3";
import Voting from "../build/contracts/Voting.json";

let web3;
let voting;
let accounts;

const initWeb3 = () => {
  return new Promise((resolve, reject) => {
    if (typeof window.ethereum !== "undefined") {
      window.ethereum
        .request({ method: "eth_requestAccounts" })
        .then((acc) => {
          updateAccounts(acc);
        })
        .then(() => {
          window.ethereum.on("accountsChanged", () => updateAccounts());
          resolve(new Web3(window.ethereum));
        })
        .catch((e) => {
          reject(e);
        });
      return;
    }
    if (typeof window.web3 !== "undefined") {
      return resolve(new Web3(window.web3.currentProvider));
    }
    resolve(new Web3("http://localhost:8545"));
  });
};

const updateAccounts = async (acc) => {
  if (web3) {
    accounts = acc || (await web3.eth.getAccounts());
  } else {
    accounts = acc;
  }
};

const initContract = async () => {
  const networkId = await web3.eth.net.getId();
  return new web3.eth.Contract(Voting.abi, Voting.networks[networkId].address);
};

const initApp = async () => {
  const $createElection = document.getElementById("createElection");

  loadElections();

  $createElection.addEventListener("submit", (e) => {
    e.preventDefault();
    const electionName = web3.utils.asciiToHex(e.target.electionName.value);
    const electionProposal = e.target.electionProposal.value;
    const registrationDeadline = e.target.registrationDeadline.value;
    const votingDeadline = e.target.votingDeadline.value;
    const electionDeadline = e.target.endingTime.value;

    voting.methods
      .createElection(electionName, electionProposal, registrationDeadline, votingDeadline, electionDeadline)
      .send({ from: accounts[0] })
      .on("receipt", (receipt) => {
        const electionName = receipt.events.ElectionCreated.returnValues.electionName;
        displayElection(electionName);
      });
  });
};

const loadElections = async () => {
  const numberOfElections = await voting.methods.getNumberOfElections().call({ from: accounts[0] });

  for (let i = 0; i < numberOfElections; i++) {
    const electionName = await voting.methods.electionList(i).call({ from: accounts[0] });
    displayElection(electionName);
  }
};

const displayElection = (electionName) => {
  const $elections = document.getElementById("elections");

  voting.methods
    .elections(electionName)
    .call({ from: accounts[0] })
    .then((election) => {
      const $template = document.getElementById("cardElectionTemplate");
      const $clone = $template.content.cloneNode(true);

      const electionIDsToModify = [
        "cardElectionName-",
        "cardElectionProposal-",
        "cardCountdowns-",
        "cardRegistrationCountdown-",
        "cardVotingCountdown-",
        "cardElectionCountdown-",
        "cardRegisterCandidate-",
        "cardElectionCandidateList-"
      ];

      for (let electionID of electionIDsToModify) {
        $clone.querySelector("#" + electionID).id = electionID + electionName;
      }

      $clone.querySelector(".card-img-top").src = `https://source.unsplash.com/random/200x200?sig=${getRandomInt(
        100,
        500
      )}`;

      $clone.querySelector("#cardElectionName-" + electionName).textContent = web3.utils.hexToUtf8(electionName);
      $clone.querySelector("#cardElectionProposal-" + electionName).textContent = election.proposal;

      const $registrationCountdown = $clone.querySelector("#cardRegistrationCountdown-" + electionName);
      appendCountdownTimerFor(election.registrationDeadline, $registrationCountdown);

      const $votingCountdown = $clone.querySelector("#cardVotingCountdown-" + electionName);
      appendCountdownTimerFor(election.votingDeadline, $votingCountdown);

      const $electionCountdown = $clone.querySelector("#cardElectionCountdown-" + electionName);
      appendCountdownTimerFor(election.endingTime, $electionCountdown);

      const $cardRegisterCandidate = $clone.querySelector("#cardRegisterCandidate-" + electionName);
      $cardRegisterCandidate.addEventListener("click", () => {
        registerCandidate(electionName);
      });

      // NOTE: Weird behaviour on the UI versus appendChild()
      $elections.prepend($clone);
    });
};

const registerCandidate = (electionName) => {
  const $registerCandidateSubmitButton = document.getElementById("registerCandidateModalSubmit");
  const $registerCandidateName = document.getElementById("registerCandidateName");

  $registerCandidateSubmitButton.addEventListener("click", (e) => {
    e.preventDefault;
    const candidateName = $registerCandidateName.value;

    if (!candidateName) return alert("Name cannot be empty");

    voting.methods
      .registerCandidate(electionName, web3.utils.utf8ToHex(candidateName))
      .send({ from: accounts[0] })
      .on("receipt", (receipt) => {
        console.log(receipt);
      })
      .on("error", (error, receipt) => {
        console.log(error);
      });
  });
  console.log(electionName);
};

const appendCountdownTimerFor = (countDownTo, el) => {
  // All Unix Epoch time handled in milliseconds to adapt to Date Object specifications
  const interval = setInterval(() => {
    const countDownToInMilliseconds = Math.floor(countDownTo * 1000);
    const now = new Date().getTime();
    const timeLeft = countDownToInMilliseconds - now;

    // Time calculations for days, hours, minutes and seconds
    let days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    let hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    let minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    let seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    el.innerHTML = days + "d " + hours + "h " + minutes + "m " + seconds + "s ";

    if (timeLeft < 0) {
      clearInterval(interval);
      el.innerHTML = "OVER";
    }
  }, 1000);
};

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
};

document.addEventListener("DOMContentLoaded", () => {
  initWeb3()
    .then((_web3) => {
      web3 = _web3;
      return initContract();
    })
    .then((_voting) => {
      voting = _voting;
      initApp();
    })
    .catch((e) => console.log(e.message));
});
