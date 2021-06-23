import Web3 from "web3";
import Voting from "../build/contracts/Voting.json";

let web3;
let voting;
let accounts;

const ALERT_MAPPINGS = {
  info: "info",
  warning: "warning",
  error: "danger"
};

const initWeb3 = () => {
  return new Promise((resolve, reject) => {
    if (typeof window.ethereum !== "undefined") {
      window.ethereum
        .request({ method: "eth_requestAccounts" })
        .then((acc) => {
          updateAccounts(acc);
        })
        .then(() => {
          window.ethereum.on("accountsChanged", async () => await updateAccounts());
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

  await loadElections();
  await loadCandidates();

  $createElection.addEventListener("submit", (e) => {
    e.preventDefault();

    const electionName = web3.utils.asciiToHex(document.getElementById("electionName").value)
    const electionProposal = document.getElementById("electionProposal").value
    const registrationDeadline = document.getElementById("registrationDeadline").value
    const votingDeadline = document.getElementById("votingDeadline").value
    const electionDeadline = document.getElementById("endingTime").value

    voting.methods
      .createElection(electionName, electionProposal, registrationDeadline, votingDeadline, electionDeadline)
      .send({ from: accounts[0] })
      .on("receipt", (receipt) => {
        console.log(receipt)
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

const loadCandidates = async () => {
  const numberOfCandidates = await voting.methods.getNumberOfCandidates().call({ from: accounts[0] })

  for (let i = 0; i < numberOfCandidates; i++) {
    const candidateAddress = await voting.methods.candidateList(i).call({ from: accounts[0] })
    const candidate = await voting.methods.candidates(candidateAddress).call({ from: accounts[0] })

    await displayCandidate(candidate.electionKey, candidate.name, candidateAddress)
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
      $cardRegisterCandidate.addEventListener(
        "click",
        () => {
          registerCandidate(electionName);
        }
      );

      // NOTE: Weird behaviour on the UI versus appendChild()
      $elections.prepend($clone);
    });
};

const registerCandidate = (electionName) => {
  const $registerCandidateSubmitButton = document.getElementById("registerCandidateModalSubmit");
  const $registerCandidateName = document.getElementById("registerCandidateName");
  const $modal = document.getElementById("registerCandidateModal");

  const controller = new AbortController()
  $registerCandidateSubmitButton.addEventListener("click", (e) => {
    const candidateName = $registerCandidateName.value;

    if (!candidateName) return alert("Name cannot be empty");

    voting.methods
      .registerCandidate(electionName, web3.utils.utf8ToHex(candidateName))
      .send({ from: accounts[0] })
      .on("receipt", async (receipt) => {
        console.log(receipt);
        await displayCandidate(electionName, web3.utils.utf8ToHex(candidateName), receipt.from)
        const event = parseEvent(receipt)
        showAlert(
          ALERT_MAPPINGS.info,
          `Candidate ${web3.utils.hexToUtf8(event.candidateName)} registered to ${web3.utils.hexToUtf8(event.electionName)}`
        )
        $registerCandidateName.value = ""
      })
      .on("error", (error, receipt) => {
        console.log(error);
        showAlert(ALERT_MAPPINGS.error, parseErrorMessage(error))
        $registerCandidateName.value = ""
      });

    controller.abort()
  },
    { signal: controller.signal }
  );
};

const parseEvent = (receipt) => {
  const eventObj = receipt.events
  const eventKey = Object.keys(eventObj)[0]

  return eventObj[eventKey].returnValues
};

const displayCandidate = async (electionName, candidateName, candidateAddress) => {
  const $candidateList = document.getElementById("cardElectionCandidateList-" + electionName)
  const $candidateTemplate = document.getElementById("cardCandidateTemplate");
  const $candidateClone = $candidateTemplate.content.cloneNode(true)

  const $candidateName = $candidateClone.querySelector("#cardCandidateName-")
  $candidateName.id = $candidateName.id + candidateAddress

  const $candidateVoteButton = $candidateClone.querySelector("#cardVoteForCandidate-")
  $candidateVoteButton.id = $candidateVoteButton.id + candidateAddress

  const $candidateRemoveButton = $candidateClone.querySelector("#cardRemoveCandidate-")
  $candidateRemoveButton.id = $candidateRemoveButton.id + candidateAddress

  $candidateName.textContent = web3.utils.hexToUtf8(candidateName)

  $candidateVoteButton.addEventListener("click", () => voteForCandidate(electionName, candidateAddress))
  $candidateRemoveButton.addEventListener("click", () => removeCandidate(candidateAddress))

  $candidateList.appendChild($candidateClone)
};

const voteForCandidate = async (electionName, candidateAddress) => {
  voting.methods
    .vote(electionName, candidateAddress)
    .send({ from: accounts[0] })
    .on("receipt", (receipt) => {
    })
    .on("error", (error, receipt) => {
    })
};

const removeCandidate = async (candidateAddress) => {
  voting.methods
    .deleteCandidate(candidateAddress)
    .send({ from: accounts[0] })
    .on("receipt", (receipt) => {
      
    })
    .on("error", (error, receipt) => {
      showAlert(ALERT_MAPPINGS.error, parseErrorMessage(error))
    })
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

const showAlert = (level, message) => {
  const $alert = document.getElementById("alertArea")

  const elements = `
    <div class="alert alert-${level} alert-dismissible fade show" role="alert">
      <strong>Mamma Mia!</strong> ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `

  $alert.innerHTML = elements
};

const parseErrorMessage = (error) => {
  const regex = new RegExp(/(?<=\')(.*)(?=\')/gm)
  const str = error.message
  const json = JSON.parse(str.match(regex))
  const data = json.value.data.data
  const lookupKey = Object.keys(data)[0]

  return data[lookupKey].reason
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
