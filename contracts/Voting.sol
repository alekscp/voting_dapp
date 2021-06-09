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
    mapping(address => Voter) public voters;

    struct Candidate {
        bytes32 name;
        bytes32 electionName;
        uint256 votes;
        address candidateAddress;
    }
    mapping(address => Candidate) public candidates;
    address[] candidateList;

    struct Election {
        bytes32 name;
        string proposal;
        uint registrationDeadline; // In seconds
        uint votingDeadline; // In seconds
        uint endingTime; // In seconds
    }
    mapping(uint => Election) public elections;
    mapping(bytes32 => uint) private electionNameMap;
    bytes32[] electionList;

    uint electionIndex;

    function newElection(bytes32 _name, string memory _proposal, uint _registrationDeadline, uint _votingDeadline, uint _endingTime) public  returns (bool) {
        for (uint i = 0; i < electionList.length; i++) {
            require(
                keccak256(abi.encodePacked(electionList[i])) != keccak256(abi.encodePacked(_name)), 
                'Election with that name already exists.'
            );
        }

        Election storage election = elections[electionIndex];

        election.name = _name;
        election.proposal = _proposal;
        election.registrationDeadline = block.timestamp + _registrationDeadline;
        election.votingDeadline = block.timestamp + _votingDeadline;
        election.endingTime = block.timestamp + _endingTime;

        electionNameMap[_name] = electionIndex;
        electionList.push(_name);

        electionIndex++;
        
        return true;
    }

    function getElectionCandidates(bytes32 electionName) public view returns (Candidate[] memory) {
        //Election storage e = elections[electionNameMap[electionName]];
        uint256 candidateCount;

        // Determine total number of candidates
        for (uint i = 0; i < candidateList.length; i++) {
            candidateCount++;
        }

        // Create fixed length array to store all the candidates
        Candidate[] memory result = new Candidate[](candidateCount);

        // Fill in the result array with all the candidates from a given election
        for (uint i = 0; i < candidateList.length; i++) {
            Candidate storage c = candidates[candidateList[i]];
            
            if (c.electionName == electionName) { result[i] = (candidates[candidateList[i]]); }
        }

        return result;
    }

    function registerCandidate(bytes32 electionName, bytes32 candidateName) public {
        uint index = electionNameMap[electionName];
        Election storage e = elections[index];

        require(keccak256(abi.encodePacked(electionList[index])) == keccak256(abi.encodePacked(electionName)), 'No election with that name found.');
        require(block.timestamp < e.registrationDeadline, 'Registration period has ended.');
        require(candidates[msg.sender].electionName != electionName, 'Candidate already registered for that election.');
        
        Candidate memory c = Candidate(candidateName, electionName, 0, msg.sender);

        candidates[msg.sender] = c;
        candidateList.push(msg.sender);
    }

    function removeCandidate(bytes32 electionName, address canditateAddress) public {
        require(msg.sender == canditateAddress, 'Only candidate can remove himself/herself from an election.');
        
        Candidate memory c = candidates[msg.sender];
        
        if (c.electionName == electionName) {
            delete candidates[msg.sender];
        } else {
            revert("This candidate is not registered in that election.");
        }
    }

    function vote(bytes32 electionName, address candidateAddress) public returns (bool) {
        uint index = electionNameMap[electionName];

        require(electionList[index] == electionName, 'No election with that name found.');

        Election storage e = elections[index];

        require(block.timestamp < e.endingTime, 'Election has already ended.');
        require(block.timestamp < e.votingDeadline, 'Voting period is over.');
        require(block.timestamp < e.registrationDeadline, 'Candidates are still registering.');
        
        Voter storage v = voters[msg.sender];
        Candidate storage c = candidates[candidateAddress];

        require(v.hasVoted != true, 'Voter has already voted.');

        v.voterAddress = msg.sender;
        v.candidateAddress = candidateAddress;
        v.hasVoted = true;
        
        c.votes++;
        
        return true;
    }
}
