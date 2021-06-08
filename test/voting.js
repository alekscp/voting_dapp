const Voting = artifacts.require('Voting');
const { time } = require('@openzeppelin/test-helpers');

contract('Voting', accounts => {
  const deploy = async () => {
    instance = await Voting.new();
    registrationDeadline = 140, votingDeadline = 280, endingTime = 560;
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
      await time.increase(registrationDeadline);

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
      const candidateName = web3.utils.toHex('bob');

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
      const [candidate1, candidate2, candidate3] = accounts
      await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
      await instance.registerCandidate(electionName, web3.utils.toHex('Candidate 1'), { from: candidate1 })
      await instance.registerCandidate(electionName, web3.utils.toHex('Candidate 2'), { from: candidate2 })
      await instance.registerCandidate(electionName, web3.utils.toHex('Candidate 3'), { from: candidate3 })
    })

    it('returns an array containing all the candidates', async () => {
      const candidates = await instance.getElectionCandidates(electionName)
      assert(candidates.length >= 3)
    })
  })

  describe('removeCandidate', () => {
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

  describe('vote', () => {
    beforeEach(async () => {
      await deploy()
      electionName = web3.utils.toHex('test election');
      candidateName1 = web3.utils.toHex('Bob');
      candidateName2 = web3.utils.toHex('Bob');
      candidateName3 = web3.utils.toHex('Bob');

      [candidate1, candidate2, candidate3, voter1, voter2, voter3, voter4] = accounts
      await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });

      await instance.registerCandidate(electionName, candidateName1, { from: candidate1 })
      await instance.registerCandidate(electionName, candidateName2, { from: candidate2 })
      await instance.registerCandidate(electionName, candidateName3, { from: candidate3 })
    })

    it('registers a vote', async () => {
      const vote = await instance.vote(electionName, candidate1, { from: voter1 })
      assert.isOk(vote)
    })

    it('bumps the candidate\'s vote count by 1 for every vote registered', async () => {
      let candidate;
      candidate = await instance.candidates(candidate1)
      assert.equal(candidate.votes.toNumber(), 0)

      await instance.vote(electionName, candidate1, { from: voter1 })

      candidate = await instance.candidates(candidate1)
      assert.equal(candidate.votes.toNumber(), 1)

      await instance.vote(electionName, candidate1, { from: voter2 })

      candidate = await instance.candidates(candidate1)
      assert.equal(candidate.votes.toNumber(), 2)
    })

    it('errors if election has already ended', async () => {
      await time.increase(endingTime)

      try {
        await instance.vote(electionName, candidate1, { from: voter1 })
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Election has already ended.');
    })

    it('errors if voting period is over', async () => {
      await time.increase(votingDeadline)

      try {
        await instance.vote(electionName, candidate1, { from: voter1 })
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Voting period is over.');
    })

    it('errors if registration period is still happening', async () => {
      await time.increase(registrationDeadline + 1)

      try {
        await instance.vote(electionName, candidate1, { from: voter1 })
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Candidates are still registering.');
    })
  })
});
