const Voting = artifacts.require("Voting");
const { time } = require("@openzeppelin/test-helpers");

contract("Voting", (accounts) => {
  this.electionName = web3.utils.toHex("test election");
  this.electionProposal = "Test proposal";
  this.registrationDeadline = 140;
  this.votingDeadline = 280;
  this.endingTime = 560;

  const deploy = async () => {
    instance = await Voting.new();
  };

  const createElection = async (args) => {
    args = args || {};
    const en = args.electionName || this.electionName;
    const ep = args.electionProposal || this.electionProposal;
    const rd = args.registrationDeadline || this.registrationDeadline;
    const vd = args.votingDeadline || this.votingDeadline;
    const et = args.endingTime || this.endingTime;

    await instance.createElection(en, ep, rd, vd, et, { from: accounts[0] });
  };

  describe("createElection", async () => {
    beforeEach(async () => {
      await deploy();
      await createElection();
      originalBlock = await time.latest();
    });

    it("creates an election", async () => {
      const election = await instance.elections(this.electionName);
      assert.exists(election.name);
    });

    it("sets proposal", async () => {
      const election = await instance.elections(this.electionName);
      const proposal = await election.proposal;
      assert.equal(this.electionProposal, proposal);
    });

    it("sets registrationDeadline relative to current block timestamp", async () => {
      const election = await instance.elections(this.electionName);
      const registrationDeadline = await election.registrationDeadline.toNumber();
      assert.equal(registrationDeadline, originalBlock.toNumber() + this.registrationDeadline);
    });

    it("sets votingDeadline relative to current block timestamp", async () => {
      const election = await instance.elections(this.electionName);
      const votingDeadline = election.votingDeadline.toNumber();
      assert.strictEqual(votingDeadline, originalBlock.toNumber() + this.votingDeadline);
    });

    it("sets endingTime relative to current block timestamp", async () => {
      const election = await instance.elections(this.electionName);
      const endingTime = election.endingTime.toNumber();
      assert.strictEqual(endingTime, originalBlock.toNumber() + this.endingTime);
    });

    it("should NOT create an election if name is already taken", async () => {
      try {
        await createElection();
      } catch (error) {
        err = error;
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, "Election with that name already exists.");
    });

    describe("Logs", async () => {
      beforeEach(async () => {
        await deploy();
      });

      it("emits ElectionCreated with corret arguments", async () => {
        const transaction = await instance.createElection(
          this.electionName,
          this.electionProposal,
          this.registrationDeadline,
          this.votingDeadline,
          this.endingTime,
          { from: accounts[0] }
        );

        const logs = transaction.logs;
        const eventArgs = await logs[0].args;
        assert.equal(eventArgs.creator, accounts[0]);
        assert.equal(eventArgs.electionName, web3.utils.padRight(this.electionName, 64));
      });
    });
  });

  describe("registerCandidate", async () => {
    beforeEach(async () => {
      await deploy();
      await createElection();
    });

    it("registers a candidate to a given election", async () => {
      const candidateName = web3.utils.toHex("Bob");
      await instance.registerCandidate(this.electionName, candidateName, { from: accounts[0] });
      const election = await instance.elections(this.electionName);
      const candidate = await instance.candidates(accounts[0]);

      assert.isOk(candidate);
      assert.strictEqual(web3.utils.hexToUtf8(candidate.electionKey), web3.utils.hexToUtf8(this.electionName));
    });

    it("errors if the election does not exist", async () => {
      const nonExistingElection = web3.utils.toHex("Non existing election");
      const candidateName = web3.utils.toHex("Bob");

      try {
        await instance.registerCandidate(nonExistingElection, candidateName, { from: accounts[0] });
      } catch (error) {
        err = error;
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, "No election with that name found.");
    });

    it("errors if the registration period has ended", async () => {
      await time.increase(this.registrationDeadline);

      const candidateName = web3.utils.toHex("Bob");

      try {
        await instance.registerCandidate(this.electionName, candidateName, { from: accounts[0] });
      } catch (error) {
        err = error;
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, "Registration period has ended.");
    });

    it("errors if the candidate has already registered to an election", async () => {
      const electionName = web3.utils.toHex("Other election");
      const candidateName = web3.utils.toHex("Bob");

      await createElection({ electionName: electionName });
      await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });

      try {
        await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });
      } catch (error) {
        err = error;
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, "You have already registered for an election.");
    });

    describe("Logs", async () => {
      beforeEach(async () => {
        await deploy();
        await createElection();
      });

      it("emits CandidateRegistered with corret arguments", async () => {
        const candidateName = web3.utils.toHex("Bob");
        const transaction = await instance.registerCandidate(this.electionName, candidateName, { from: accounts[0] });

        const logs = transaction.logs;
        const eventArgs = await logs[0].args;
        assert.equal(eventArgs.candidateName, web3.utils.padRight(candidateName, 64));
        assert.equal(eventArgs.electionName, web3.utils.padRight(this.electionName, 64));
      });
    });
  });

  describe("deleteCandidate", () => {
    beforeEach(async () => {
      await deploy();
      await createElection();
    });

    it("deletes a candidate from a given election", async () => {
      const candidateAddress = accounts[0];
      const candidateName = web3.utils.toHex("Candidate 1");
      let numberOfCandidates;

      await instance.registerCandidate(this.electionName, candidateName, { from: candidateAddress });
      numberOfCandidates = await instance.getNumberOfCandidates();
      assert.equal(numberOfCandidates.toNumber(), 1);

      await instance.deleteCandidate(candidateAddress, { from: candidateAddress });
      numberOfCandidates = await instance.getNumberOfCandidates();
      assert.equal(numberOfCandidates.toNumber(), 0);
    });

    it("errors if another account tries to remove a candidate", async () => {
      const [candidateAddress, nonCandidateAddress] = accounts;
      const candidateName = web3.utils.toHex("Candidate 1");

      await instance.registerCandidate(this.electionName, candidateName, { from: candidateAddress });

      try {
        await instance.deleteCandidate(candidateAddress, { from: nonCandidateAddress });
      } catch (error) {
        err = error;
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, "Only candidate himself/herself can withdraw from election.");
    });

    describe("Logs", async () => {
      beforeEach(async () => {
        await deploy();
        await createElection();
      });

      it("emits CandidateRegistered with corret arguments", async () => {
        const candidateName = web3.utils.toHex("Bob");
        const candidateAddress = accounts[0];
        await instance.registerCandidate(this.electionName, candidateName, { from: candidateAddress });
        const transaction = await instance.deleteCandidate(candidateAddress, { from: candidateAddress });

        const logs = transaction.logs;
        const eventArgs = await logs[0].args;
        assert.equal(eventArgs.candidateName, web3.utils.padRight(candidateName, 64));
        assert.equal(eventArgs.electionName, web3.utils.padRight(this.electionName, 64));
      });
    });
  });

  describe("getNumberOfCandidates", () => {
    beforeEach(async () => {
      await deploy();
      await createElection();
    });

    it("returns the number of registered candidates", async () => {
      await instance.registerCandidate(this.electionName, web3.utils.toHex("Candidate 1"), { from: accounts[0] });
      await instance.registerCandidate(this.electionName, web3.utils.toHex("Candidate 2"), { from: accounts[1] });
      await instance.registerCandidate(this.electionName, web3.utils.toHex("Candidate 3"), { from: accounts[2] });
      await instance.registerCandidate(this.electionName, web3.utils.toHex("Candidate 4"), { from: accounts[3] });

      const numberOfCandidates = await instance.getNumberOfCandidates();
      assert.equal(numberOfCandidates.toNumber(), 4);
    });
  });

  describe("getNumberOfElections", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("returns the number of existing elections", async () => {
      await createElection({ electionName: web3.utils.toHex("Election 1") });
      await createElection({ electionName: web3.utils.toHex("Election 2") });
      await createElection({ electionName: web3.utils.toHex("Election 3") });
      await createElection({ electionName: web3.utils.toHex("Election 4") });

      const numberOfElections = await instance.getNumberOfElections();
      assert.equal(numberOfElections.toNumber(), 4);
    });
  });

  describe("vote", () => {
    beforeEach(async () => {
      await deploy();
      const candidateName1 = web3.utils.toHex("Bob");
      const candidateName2 = web3.utils.toHex("Bob");
      const candidateName3 = web3.utils.toHex("Bob");

      [candidate1, candidate2, candidate3, voter1, voter2, voter3, voter4, voter5, voter6] = accounts;
      await createElection();

      await instance.registerCandidate(this.electionName, candidateName1, { from: candidate1 });
      await instance.registerCandidate(this.electionName, candidateName2, { from: candidate2 });
      await instance.registerCandidate(this.electionName, candidateName3, { from: candidate3 });
    });

    it("registers a vote", async () => {
      const vote = await instance.vote(this.electionName, candidate1, { from: voter1 });
      assert.isOk(vote);
    });

    it("bumps the candidate's vote count by 1 for every vote registered", async () => {
      const assertVote = async (candidate, voter, expectedResult) => {
        await instance.vote(this.electionName, candidate, { from: voter });
        let instanceCandidate = await instance.candidates(candidate);
        assert.equal(instanceCandidate.voteCount.toNumber(), expectedResult);
      };

      await assertVote(candidate1, voter1, 1);
      await assertVote(candidate1, voter2, 2);
      await assertVote(candidate1, voter3, 3);
      await assertVote(candidate1, voter4, 4);
    });

    it("errors if election has already ended", async () => {
      await time.increase(this.endingTime);

      try {
        await instance.vote(this.electionName, candidate1, { from: voter1 });
      } catch (error) {
        err = error;
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, "Election has already ended.");
    });

    it("errors if voting period is over", async () => {
      await time.increase(this.votingDeadline);

      try {
        await instance.vote(this.electionName, candidate1, { from: voter1 });
      } catch (error) {
        err = error;
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, "Voting period is over.");
    });

    it("errors if registration period is still happening", async () => {
      await time.increase(this.registrationDeadline);

      try {
        await instance.vote(this.electionName, candidate1, { from: voter5 });
      } catch (error) {
        err = error;
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, "Candidates are still registering.");
    });

    it("errors if voter has already voted in election", async () => {
      await instance.vote(this.electionName, candidate1, { from: voter6 });

      try {
        await instance.vote(this.electionName, candidate1, { from: voter6 });
      } catch (error) {
        err = error;
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, "Your vote was already registered in that election.");
    });


    describe("Logs", async () => {
      it("emits VoteRegistered with corret arguments", async () => {
        await deploy();
        await createElection();
        const candidateName = web3.utils.toHex("Bob");
        const [candidate, voter] = accounts;
        await instance.registerCandidate(this.electionName, candidateName, { from: candidate });
        const transaction = await instance.vote(this.electionName, candidate, { from: voter });

        const logs = transaction.logs;
        const eventArgs = await logs[0].args;
        assert.equal(eventArgs.voter, voter);
        assert.equal(eventArgs.electionName, web3.utils.padRight(this.electionName, 64));
      });
    });
  });
});
