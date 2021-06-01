// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

// Create a dapp for voting where all of the votes and candidate registration happens on chain.
// Allow anyone to start an election with a registration period, voting period, and ending time.
// Allow anyone to sign up as a candidate during the registration period, and allow anyone to vote once during the voting period.
// Create a front end where voters can see the results and know how long is left in the election.

contract Voting {
    event ElectionCreate(address creator, string electionName);
    event CandidateRegistered(address candidate, string electionName);
    event VoteRegistered(address voter, string electionName);

    struct Voter {
        address voterAddress;
        address candidateAddress;
        bool hasVoted;
    }

    struct Candidate {
        string name;
        address candidateAddress;
        bool isRegisted;
    }

    struct Election {
        string name;
        uint registrationDeadline; // In seconds
        uint votingDeadline; // In seconds
        uint endingTime; // In seconds
        address[] candidateList;
        address[] voterList;
        mapping(address => Candidate) candidates;
        mapping(address => Voter) voters;
    }
    mapping(uint => Election) public elections;
    mapping(string => uint) private electionNameMap;
    string[] electionList;

    uint electionIndex;

    function newElection(string memory _name, uint _registrationDeadline, uint _votingDeadline, uint _endingTime) public {
        for (uint i = 0; i < electionList.length; i++) {
            require(
                keccak256(abi.encodePacked(electionList[i])) != keccak256(abi.encodePacked(_name)), 
                'Election with that name already exists'
            );
        }

        Election storage election = elections[electionIndex];

        election.name = _name;
        election.registrationDeadline = block.timestamp + _registrationDeadline;
        election.votingDeadline = block.timestamp + _votingDeadline;
        election.endingTime = block.timestamp + _endingTime;

        electionNameMap[_name] = electionIndex;
        electionList.push(_name);

        electionIndex++;
    }

    function getElectionCandidate(string memory electionName, address candidateAddress) public view returns (Candidate memory) {
        Election storage e = elections[electionNameMap[electionName]];

        return(e.candidates[candidateAddress]);
    }

    function getElectionCandidates(string memory electionName) public view returns (Candidate[] memory) {
        Election storage e = elections[electionNameMap[electionName]];
        uint256 candidateCount;

        // Determine number of candidates in an Election
        for (uint i = 0; i < e.candidateList.length; i++) {
            candidateCount++;
        }

        // Create fixed length array to store all the candidates
        Candidate[] memory result = new Candidate[](candidateCount);

        // Fill in the result array with all the candidates
        for (uint i = 0; i < e.candidateList.length; i++) {
            result[i] = (e.candidates[e.candidateList[i]]);
        }

        return result;
    }

    function registerCandidate(string memory electionName, string memory candidateName) public {
        uint index = electionNameMap[electionName];

        require(keccak256(abi.encodePacked(electionList[index])) == keccak256(abi.encodePacked(electionName)), 'No election with that name found.');

        Election storage e = elections[index];

        require(e.candidates[msg.sender].isRegisted != true, 'Candidate already registered.');

        require(block.timestamp <= e.registrationDeadline, 'Registration period has ended.');

        Candidate memory c = Candidate(candidateName, msg.sender, true);

        e.candidateList.push(msg.sender);
        e.candidates[msg.sender] = c;
    }

    function removeCandidate(string memory electionName, address canditateAddress) public {
        uint index = electionNameMap[electionName];

        require(keccak256(abi.encodePacked(electionList[index])) == keccak256(abi.encodePacked(electionName)), 'No election with that name found.');

        Election storage e = elections[index];

        delete e.candidates[canditateAddress];
    }

    function vote(string memory electionName, address canditateAddress) public {
        uint index = electionNameMap[electionName];

        require(keccak256(abi.encodePacked(electionList[index])) == keccak256(abi.encodePacked(electionName)), 'No election with that name found.');

        Election storage e = elections[index];

        require(block.timestamp <= e.endingTime, 'Election has already ended.');
        require(block.timestamp <= e.votingDeadline, 'Voting period is over.');
        require(block.timestamp <= e.registrationDeadline && block.timestamp >= e.votingDeadline, 'Candidates are still registering.');

        require(e.voters[msg.sender].hasVoted != true, 'Voter has already voted.');

        Voter memory v = Voter(msg.sender, canditateAddress, true);

        e.voters[msg.sender] = v;
    }

}
