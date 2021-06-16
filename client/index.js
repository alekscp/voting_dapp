import Web3 from 'web3';
import Voting from '../build/contracts/Voting.json';

let web3;
let voting;
let accounts;

const initWeb3 = () => {
  return new Promise((resolve, reject) => {
    if(typeof window.ethereum !== 'undefined') {
      // const web3 = new Web3(window.ethereum);
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(() => {
          resolve(new Web3(window.ethereum));
        })
        .catch(e => {
          reject(e);
        })
      return;
    }
    if(typeof window.web3 !== 'undefined') {
      return resolve(
        new Web3(window.web3.currentProvider)
      );
    }
    resolve(new Web3('http://localhost:8545'));
  })
};

const initContract = async () => {
  const networkId = await web3.eth.net.getId();
  return new web3.eth.Contract(
    Voting.abi,
    Voting
      .networks[networkId]
      .address
  );
};

// const loadElections = async (accounts) => {
//   const numberOfElections = await voting.methods.getNumberOfElections().call({ from: accounts[0] })
//   console.log(numberOfElections(

//   for (let i = 0; i < numberOfElections; i++) {
//     const electionName = voting.methods.electionList(i).call({ from: accounts[0] })
//   }
//   const $template = document.getElementById('cardElectionTemplate');
//   console.log($template)
// };

const initApp = async () => {
  const $createElection = document.getElementById('createElection');
  accounts = await web3.eth.getAccounts()

  // loadElections(accounts)

  $createElection.addEventListener('submit', (e) => {
    e.preventDefault();
    const electionName = web3.utils.asciiToHex(e.target.electionName.value)
    const electionProposal = e.target.electionProposal.value
    const registrationDeadline = e.target.registrationDeadline.value
    const votingDeadline = e.target.votingDeadline.value
    const electionDeadline = e.target.endingTime.value

    voting.methods
      .createElection(electionName, electionProposal, registrationDeadline, votingDeadline, electionDeadline)
      .send({ from : accounts[0] })
      .on('receipt', (receipt) => {
        displayElection(receipt)
      })
  })
};

const displayElection = (receipt) => {
  const electionName = receipt.events.ElectionCreated.returnValues.electionName
  const $elections = document.getElementById('elections')

  voting.methods.elections(electionName)
    .call({ from: accounts[0] })
    .then(election => {
      const $template = document.getElementById('cardElectionTemplate')
      const $clone = $template.content.cloneNode(true);

      const electionIDsToModify = ['cardElectionName-', 'cardElectionProposal-', 'cardCountdowns-', 'cardRegistrationCountdown-', 'cardVotingCountdown-', 'cardElectionCountdown-', 'cardElectionCandidateList-']

      for (let electionID of electionIDsToModify) {
        $clone.querySelector('#' + electionID).id = electionID + electionName
      }

      $clone.querySelector('#cardElectionName-' + electionName).textContent = web3.utils.hexToUtf8(electionName)
      $clone.querySelector('#cardElectionProposal-' + electionName).textContent = election.proposal

      const $registrationCountdown = $clone.querySelector('#cardRegistrationCountdown-' + electionName)
      appendCountdownTimerFor(election.registrationDeadline, $registrationCountdown)

      const $votingCountdown = $clone.querySelector('#cardVotingCountdown-' + electionName)
      appendCountdownTimerFor(election.votingDeadline, $votingCountdown)

      const $electionCountdown = $clone.querySelector('#cardElectionCountdown-' + electionName)
      appendCountdownTimerFor(election.endingTime, $electionCountdown)

      $elections.appendChild($clone)
    })
};

const appendCountdownTimerFor = (countDownTo, el) => {
  console.log(el)
  // All Unix Epoch time handled in milliseconds to adapt to Date Object specifications
  const interval = setInterval(() => {
    const countDownToInMilliseconds = Math.floor(countDownTo * 1000)
    const now = new Date().getTime();
    const timeLeft = countDownToInMilliseconds - now

    // Time calculations for days, hours, minutes and seconds
    let days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    let hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    let minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    let seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    el.innerHTML = days + "d " + hours + "h " + minutes + "m " + seconds + "s ";

    if (timeLeft < 0) {
      clearInterval(interval)
      el.innerHTML = "OVER"
    }
  }, 1000)
};

document.addEventListener('DOMContentLoaded', () => {
  initWeb3()
    .then(_web3 => {
      web3 = _web3;
      return initContract();
    })
    .then(_voting => {
      voting = _voting;
      initApp();
    })
    .catch(e => console.log(e.message));
});
