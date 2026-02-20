from sensors import simulate_facility
from value_chain import run_value_chain
from ledger import print_ledger
from visualize import plot_value_chain

if __name__ == '__main__':
    print("Simulating facility sensors (1 hour of data)...")
    raw_data = simulate_facility(n_readings=720)

    print("Running value chain model...")
    results = run_value_chain(raw_data)

    print_ledger(results)
    plot_value_chain(results['timeseries'], results)