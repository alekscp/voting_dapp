const Voting = artifacts.require('Voting');
const { time } = require('@openzeppelin/test-helpers');

contract('Voting', accounts => {
  const deploy = async () => {
    instance = await Voting.new();
    registrationDeadline = 60, votingDeadline = 120, endingTime = 240;
  }

  describe('newElection', async () => {
    beforeEach(async () => {
      await deploy()
      electionName = web3.utils.toHex('test election');
      await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });

      originalBlock = await time.latest()
    });

    it('creates an election', async () => {
      const election = await instance.elections(0);
      assert.exists(election.name);
    });

    it('sets registrationDeadline relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      assert.strictEqual(election.registrationDeadline.toNumber(), originalBlock.toNumber() + registrationDeadline);
    });

    it('sets votingDeadline relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      assert.strictEqual(election.votingDeadline.toNumber(), originalBlock.toNumber() + votingDeadline);
    });

    it('sets endingTime relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      assert.strictEqual(election.endingTime.toNumber(), originalBlock.toNumber() + endingTime);
    });

    it('should NOT create an election if name is already taken', async () => {
      try {
        await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
      } catch (error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Election with that name already exists.');
    });
  });

  describe('registerCandidate', async () => {
    beforeEach(async () => {
      await deploy()
      electionName = web3.utils.toHex('test election');
      await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
    })

    it('registers a candidate to a given election', async () => {
      const candidateName = web3.utils.toHex('Bob');
      await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });
      const election = await instance.elections(0);
      const candidate = await instance.candidates(accounts[0]);

      assert.isOk(candidate);
      assert.strictEqual(web3.utils.hexToUtf8(candidate.electionName), web3.utils.hexToUtf8(electionName));
    });

    it('errors if the election does not exist', async () => {
      const otherElectionName = web3.utils.toHex('other');
      const candidateName = web3.utils.toHex('Bob');

      try {
        await instance.registerCandidate(otherElectionName, candidateName, { from: accounts[0] });
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'No election with that name found.');
    });

    it('errors if the registration period has ended', async () => {
      time.increase(registrationDeadline + 10);

      // const electionName = web3.utils.toHex('test');
      const candidateName = web3.utils.toHex('Bob');

      try {
        await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });
      } catch(error) {
        err = error
      };

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Registration period has ended.');
    });

    it('errors if the candidate has already registered to that election', async () => {
      const electionName = web3.utils.toHex('other test');
      const candidateName = web3.utils.toHex('Bob');

      await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
      await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });

      try {
        await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });
      } catch(error) {
        err = error
      };

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Candidate already registered for that election.');
    });
  });

  describe('getElectionCandidates', () => {
    beforeEach(async () => {
      await deploy()
      electionName = web3.utils.toHex('test election');
      await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
    })
  })

  describe('remmoveCandidate', () => {
    beforeEach(async () => {
      await deploy()
      electionName = web3.utils.toHex('test election');
      candidateName = web3.utils.toHex('Bob');
      await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
    })

    it('removes a candidate from a given election', async () => {
      const candidateAddress = accounts[0]
      const nonCandidateAddress = accounts[1]

      await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });
      await instance.removeCandidate(electionName, candidateAddress)

      const candidate = await instance.candidates(candidateAddress)

      assert.equal(candidate.candidateAddress, 0)
    })

    it('errors if another account tries to remove a candidate', async () => {
      const candidateAddress = accounts[0]
      const nonCandidateAddress = accounts[1]

      try {
        await instance.removeCandidate(electionName, nonCandidateAddress)
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Only candidate can remove himself/herself from an election.');
    })

    it('errors if that candidate is not found in the election', async () => {
      const candidateAddress = accounts[3]

      try {
        await instance.removeCandidate(electionName, candidateAddress, { from: candidateAddress })
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'This candidate is not registered in that election.');
    })
  })
});
